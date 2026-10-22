(() => {
  "use strict";

  const PROGRAMS = ["Matematika", "Statistika", "Ilmu Aktuaria"];
  const STORAGE_KEY = "radian-course-plans-v1";
  const courses = [...(window.kurikulumData || [])].sort((a, b) => {
    const semesterDifference = (a.semester ?? 9) - (b.semester ?? 9);
    return semesterDifference || a.kode.localeCompare(b.kode, "id-ID");
  });
  const byCode = new Map(courses.map((course) => [course.kode, course]));
  const nameIndex = new Map();
  const courseDependents = new Map();
  const initialPlans = loadSavedPlans();
  const state = {
    view: "map",
    mapProgram: PROGRAMS[0],
    plannerProgram: initialPlans.program,
    passed: new Set(),
    plans: initialPlans.plans,
    currentPlanId: initialPlans.currentPlanId,
    manualChecks: new Set(),
    focusedCourse: null,
    flippedCourse: null,
    courseQuery: "",
    passedQuery: "",
    courseScope: "all",
    theme: "light"
  };

  const $ = (selector) => document.querySelector(selector);
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
  const normalize = (value) => String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("id-ID")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  function createPlan(index) {
    return {
      id: `plan-${Date.now()}-${index}`,
      title: `Semester ${index}`,
      gpa: "",
      courses: []
    };
  }

  function loadSavedPlans() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved || !Array.isArray(saved.plans) || !saved.plans.length) {
        return { program: PROGRAMS[0], plans: [createPlan(1)], currentPlanId: null };
      }
      const plans = saved.plans
        .filter((plan) => plan && typeof plan.id === "string" && Array.isArray(plan.courses))
        .map((plan, index) => ({
          id: plan.id,
          title: typeof plan.title === "string" ? plan.title : `Semester ${index + 1}`,
          gpa: typeof plan.gpa === "string" || typeof plan.gpa === "number" ? String(plan.gpa) : "",
          courses: [...new Set(plan.courses.filter((code) => byCode.has(code)))]
        }));
      if (!plans.length) plans.push(createPlan(1));
      return {
        program: PROGRAMS.includes(saved.program) ? saved.program : PROGRAMS[0],
        plans,
        currentPlanId: plans.some((plan) => plan.id === saved.currentPlanId)
          ? saved.currentPlanId
          : plans[0].id
      };
    } catch (error) {
      console.error("Gagal membaca rencana tersimpan dari penyimpanan lokal.", error);
      return { program: PROGRAMS[0], plans: [createPlan(1)], currentPlanId: null };
    }
  }

  function activePlan() {
    return state.plans.find((plan) => plan.id === state.currentPlanId) || state.plans[0];
  }

  function allPlannedCodes() {
    return new Set(state.plans.flatMap((plan) => plan.courses));
  }

  function savePlans(announce = false) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 1,
        program: state.plannerProgram,
        plans: state.plans,
        currentPlanId: state.currentPlanId,
        passed: [...state.passed],
        manualChecks: [...state.manualChecks]
      }));
      $("#save-status").textContent = announce ? "Rencana tersimpan" : "Tersimpan di perangkat";
      $("#save-status").classList.remove("save-error");
    } catch (error) {
      $("#save-status").textContent = "Gagal menyimpan — izinkan penyimpanan browser";
      $("#save-status").classList.add("save-error");
      console.error("Gagal menyimpan rencana kuliah ke penyimpanan lokal.", error);
    }
  }

  function restoreProgress() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved) return;
      state.passed = new Set(Array.isArray(saved.passed) ? saved.passed.filter((code) => byCode.has(code)) : []);
      state.manualChecks = new Set(Array.isArray(saved.manualChecks) ? saved.manualChecks.filter((key) => typeof key === "string") : []);
    } catch (error) {
      console.error("Gagal membaca progres rencana kuliah dari penyimpanan lokal.", error);
    }
  }

  for (const course of courses) {
    const key = normalize(course.nama);
    if (!nameIndex.has(key)) nameIndex.set(key, []);
    nameIndex.get(key).push(course);
  }

  function getRequirements(course) {
    const raw = (course.prasyarat || [])
      .flatMap((value) => String(value).split(","))
      .map((value) => value.trim().replace(/[.;\s]+$/g, ""))
      .filter((value) => value && normalize(value) !== "tidak ada");

    return raw.map((label) => {
      const cleaned = label.replace(/^(?:sudah\s+lulus|telah\s+lulus|lulus|telah\s+memperoleh|memperoleh)\s+/i, "").trim();
      const normalized = normalize(cleaned);
      const exact = nameIndex.get(normalized) || [];
      if (exact.length === 1 && exact[0].kode !== course.kode) {
        return { label, course: exact[0], credits: null };
      }

      const creditMatch = cleaned.match(/(\d+(?:[.,]\d+)?)\s*(?:sks)\b/i);
      if (creditMatch) {
        return { label, course: null, credits: Number(creditMatch[1].replace(",", ".")) };
      }

      const partialMatches = courses.filter((candidate) =>
        candidate.kode !== course.kode &&
        (normalize(candidate.nama).startsWith(normalized) || normalize(candidate.nama).endsWith(` ${normalized}`))
      );
      if (partialMatches.length === 1) {
        return { label, course: partialMatches[0], credits: null };
      }
      return { label, course: null, credits: null };
    });
  }

  for (const course of courses) {
    for (const requirement of getRequirements(course)) {
      if (!requirement.course) continue;
      if (!courseDependents.has(requirement.course.kode)) courseDependents.set(requirement.course.kode, new Set());
      courseDependents.get(requirement.course.kode).add(course.kode);
    }
  }

  function maxCreditsForGpa(value) {
    const gpa = Number(value);
    if (value === "" || !Number.isFinite(gpa) || gpa < 0 || gpa > 4) return null;
    if (gpa >= 3.5) return 24;
    if (gpa >= 3) return 21;
    if (gpa >= 2.5) return 18;
    if (gpa >= 2) return 15;
    return 12;
  }

  function completedCredits() {
    return [...state.passed].reduce((total, code) => total + (byCode.get(code)?.sks || 0), 0);
  }

  function priorSemesterCodes() {
    const currentIndex = state.plans.findIndex((plan) => plan.id === state.currentPlanId);
    return new Set(state.plans.slice(0, Math.max(currentIndex, 0)).flatMap((plan) => plan.courses));
  }

  function creditsBeforeCurrentPlan() {
    const previousCodes = priorSemesterCodes();
    return completedCredits() + [...previousCodes].reduce((total, code) => total + (byCode.get(code)?.sks || 0), 0);
  }

  function externalToProgram(course) {
    return !(course.prodi || []).includes(state.plannerProgram);
  }

  function requirementState(course, requirement) {
    if (requirement.course) {
      const previousPlan = state.plans.slice(0, Math.max(state.plans.findIndex((plan) => plan.id === state.currentPlanId), 0))
        .find((plan) => plan.courses.includes(requirement.course.kode));
      return {
        complete: state.passed.has(requirement.course.kode) || Boolean(previousPlan),
        planned: !state.passed.has(requirement.course.kode) && Boolean(previousPlan),
        manual: false,
        text: previousPlan
          ? `${requirement.course.nama} · ${previousPlan.title}`
          : `${requirement.course.nama} (${requirement.course.kode})`
      };
    }
    if (requirement.credits !== null) {
      const completed = creditsBeforeCurrentPlan();
      return {
        complete: completed >= requirement.credits,
        manual: false,
        text: `${requirement.label} — ${completed} / ${requirement.credits} SKS lulus/direncanakan sebelumnya`
      };
    }
    const key = `${course.kode}::${normalize(requirement.label)}`;
    return {
      complete: state.manualChecks.has(key),
      manual: true,
      key,
      text: requirement.label
    };
  }

  function eligibility(course) {
    const requirements = getRequirements(course);
    const missing = requirements.map((requirement) => ({
      requirement,
      status: requirementState(course, requirement)
    })).filter((item) => !item.status.complete);
    return {
      eligible: missing.length === 0,
      missing,
      requirements
    };
  }

  function shortCategory(course) {
    return String(course.kategori || "Mata Kuliah").replace(/^Mata Kuliah\s*/i, "");
  }

  function renderMap() {
    const programCourses = courses.filter((course) => (course.prodi || []).includes(state.mapProgram));
    const curriculumCourses = programCourses.filter((course) => !isElective(course));
    const electiveCourses = programCourses.filter(isElective);
    state.mapProgramCourses = new Set(programCourses.map((course) => course.kode));
    state.focusedCourse = null;
    state.flippedCourse = null;
    $("#map-course-count").textContent = String(programCourses.length);
    $("#choice-count").textContent = String(electiveCourses.length);
    const grid = $("#map-grid");
    const connector = $("#connector-layer");
    grid.querySelectorAll(".semester-column, .empty-map").forEach((node) => node.remove());
    connector.replaceChildren();
    const grouped = new Map();
    for (let semester = 1; semester <= 8; semester += 1) grouped.set(semester, []);
    for (const course of curriculumCourses) {
      if (course.semester && grouped.has(course.semester)) grouped.get(course.semester).push(course);
    }
    orderSemesterCourses(grouped);

    $("#semester-jumps").innerHTML = Array.from({ length: 8 }, (_, index) =>
      `<button type="button" class="semester-jump" data-jump="semester-${index + 1}" aria-label="Lompat ke semester ${index + 1}">${index + 1}</button>`
    ).join("");

    for (const [semester, group] of grouped) {
      const credits = group.reduce((sum, course) => sum + (course.sks || 0), 0);
      const column = document.createElement("section");
      column.className = "semester-column";
      column.id = `semester-${semester}`;
      column.setAttribute("aria-label", `Semester ${semester}, ${group.length} mata kuliah, ${credits} SKS`);
      column.innerHTML = `
        <header class="column-heading">
          <div class="column-heading-top">
            <h3>Semester ${semester}</h3>
            <span class="column-number">${String(semester).padStart(2, "0")}</span>
          </div>
          <span class="column-meta">${group.length} mata kuliah · ${credits} SKS</span>
        </header>
        <div class="column-courses">${group.map((course) => renderMapCard(course)).join("")}</div>`;
      grid.append(column);
    }
    $("#choice-grid").innerHTML = electiveCourses.length
      ? electiveCourses.map((course) => renderMapCard(course)).join("")
      : '<p class="empty-map">Belum ada mata kuliah pilihan di prodi ini.</p>';
    if (!programCourses.length) {
      const empty = document.createElement("p");
      empty.className = "empty-map";
      empty.textContent = "Belum ada data mata kuliah untuk program studi ini.";
      grid.append(empty);
    }
    $("#semester-jumps").querySelectorAll("[data-jump]").forEach((button) => {
      button.addEventListener("click", () => {
        document.getElementById(button.dataset.jump)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
      });
    });
    document.querySelectorAll("#map-grid [data-course-link], #choice-grid [data-course-link]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        highlightCourse(button.dataset.courseLink);
      });
    });
    document.querySelectorAll("#map-grid [data-flip-course], #choice-grid [data-flip-course]").forEach((button) => {
      button.addEventListener("click", () => toggleCourseCard(button.dataset.flipCourse));
    });
    document.querySelectorAll("#map-grid [data-close-flip], #choice-grid [data-close-flip]").forEach((button) => {
      button.addEventListener("click", () => {
        state.flippedCourse = null;
        document.querySelectorAll(".course-card").forEach((card) => {
          card.classList.remove("is-flipped");
          card.querySelector(".course-focus-button")?.setAttribute("aria-expanded", "false");
        });
        const opener = document.querySelector(`#map-grid [data-flip-course="${CSS.escape(button.dataset.closeFlip)}"], #choice-grid [data-flip-course="${CSS.escape(button.dataset.closeFlip)}"]`);
        opener?.focus();
        document.querySelectorAll(".course-card-back").forEach((back) => back.setAttribute("aria-hidden", "true"));
      });
    });
    updatePathSelection();
    drawConnectors();
  }

  function isElective(course) {
    return !course.semester || /pilihan/i.test(course.kategori || "");
  }

  function renderMapCard(course) {
    const requirements = getRequirements(course);
    const isOptional = isElective(course);
    const prereqHtml = requirements.length
      ? requirements.map((requirement) => requirement.course
        ? `<button type="button" class="prereq-link" data-course-link="${escapeHtml(requirement.course.kode)}" title="Temukan ${escapeHtml(requirement.course.nama)} di peta">${escapeHtml(requirement.course.nama)}</button>`
        : `<span class="prereq-unresolved" title="Prasyarat ini perlu diverifikasi pada sumber kurikulum">${escapeHtml(requirement.label)}</span>`
      ).join("")
      : '<span class="no-prereqs">Tidak ada</span>';
    return `
      <article class="course-card${state.flippedCourse === course.kode ? " is-flipped" : ""}" data-course="${escapeHtml(course.kode)}">
        <div class="course-card-inner">
          <div class="course-card-front">
            <button class="course-focus-button" type="button" data-flip-course="${escapeHtml(course.kode)}" aria-label="Lihat detail ${escapeHtml(course.nama)}" aria-expanded="${state.flippedCourse === course.kode}">
              <span class="front-course-name">${escapeHtml(course.nama)}</span>
              <span class="front-course-action" aria-hidden="true">i</span>
            </button>
          </div>
          <div class="course-card-back" aria-hidden="${state.flippedCourse !== course.kode}">
            <div class="card-topline">
              <span class="card-code">${escapeHtml(course.kode)}</span>
              <span class="card-credits">${escapeHtml(course.sks)} SKS</span>
            </div>
            <h4 class="card-title">${escapeHtml(course.nama)}</h4>
            <span class="category-label${isOptional ? " optional" : ""}">${escapeHtml(shortCategory(course))}</span>
            <div class="card-prereqs">
              <span class="prereq-label">Prasyarat</span>
              <div class="prereq-links">${prereqHtml}</div>
            </div>
            <button class="flip-close" type="button" data-close-flip="${escapeHtml(course.kode)}" aria-label="Tutup detail ${escapeHtml(course.nama)}">Tutup detail</button>
          </div>
        </div>
      </article>`;
  }

  function drawConnectors() {
    const mapView = $("#map-view");
    const svg = $("#connector-layer");
    if (!mapView || !svg || mapView.hidden) return;
    const viewRect = mapView.getBoundingClientRect();
    const mapScroll = $("#map-scroll");
    const choiceShelf = $("#choice-shelf");
    const choiceGrid = $("#choice-grid");
    const mapScrollRect = mapScroll.getBoundingClientRect();
    const choiceShelfRect = choiceShelf.getBoundingClientRect();
    const choiceGridRect = choiceGrid.getBoundingClientRect();
    const footnoteRect = $(".map-footnote").getBoundingClientRect();
    const height = Math.max(
      mapScrollRect.bottom,
      choiceShelfRect.bottom,
      footnoteRect.bottom
    ) - viewRect.top;
    const fullMapWidth = Math.max(
      mapView.clientWidth,
      mapScroll.scrollWidth,
      choiceShelf.scrollWidth
    );
    const scrollLeft = mapScroll.scrollLeft;
    const horizontalOffset = (element) => mapScroll.contains(element) ? scrollLeft : 0;
    svg.style.width = `${fullMapWidth}px`;
    svg.style.height = `${height}px`;
    svg.setAttribute("viewBox", `0 0 ${fullMapWidth} ${height}`);
    svg.setAttribute("width", String(fullMapWidth));
    svg.setAttribute("height", String(height));
    const choiceGridTop = choiceGridRect.top - viewRect.top + mapScroll.scrollTop;
    const routeCorridorY = choiceGridTop - 4;
    const electiveEntryGap = 16;
    const incomingElectives = new Map();
    const path = getCoursePath(state.focusedCourse);
    const pathCodes = path.all;
    const edges = [];
    for (const sourceCode of pathCodes) {
      for (const targetCode of reducedDependents(sourceCode)) {
        if (!pathCodes.has(targetCode)) continue;
        const source = mapView.querySelector(`[data-course="${CSS.escape(sourceCode)}"]`);
        const target = mapView.querySelector(`[data-course="${CSS.escape(targetCode)}"]`);
        if (!source || !target) continue;
        const sourceRect = source.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const targetIsElective = Boolean(target.closest("#choice-shelf"));
        if (targetIsElective) {
          if (!incomingElectives.has(targetCode)) incomingElectives.set(targetCode, []);
          incomingElectives.get(targetCode).push({
            sourceCode,
            source,
            sourceRect,
            target,
            targetRect
          });
        }
        edges.push({ sourceCode, targetCode, source, target, sourceRect, targetRect, targetIsElective });
      }
    }

    const electiveRoutes = new Map();
    for (const [targetCode, incoming] of incomingElectives) {
      const targetRect = incoming[0].targetRect;
      const laneX = targetRect.left - viewRect.left - 10;
      const cardHeight = targetRect.height;
      const routeCount = incoming.length;
      incoming.forEach((edge, index) => {
        const centeredOffset = index - (routeCount - 1) / 2;
        const entryY = targetRect.top - viewRect.top + mapScroll.scrollTop +
          cardHeight / 2 + centeredOffset * Math.min(electiveEntryGap, cardHeight / Math.max(routeCount, 1));
        const routeY = routeCorridorY - index * 3.5;
        electiveRoutes.set(`${edge.sourceCode}:${targetCode}`, { entryY, laneX, routeY });
      });
    }

    const paths = [];
    for (const edge of edges) {
      const {
        sourceCode, targetCode, source, target, sourceRect, targetRect, targetIsElective
      } = edge;
      const sourceCenterX = sourceRect.left + sourceRect.width / 2;
      const targetCenterX = targetRect.left + targetRect.width / 2;
      const sourceCenterY = sourceRect.top + sourceRect.height / 2;
      const targetCenterY = targetRect.top + targetRect.height / 2;
      let x1;
      let y1;
      let x2;
      let y2;
      let points;

      if (targetIsElective) {
        const route = electiveRoutes.get(`${sourceCode}:${targetCode}`);
        const sourceOffset = horizontalOffset(source);
        const sourceChannelX = sourceRect.right - viewRect.left + sourceOffset + 22;
        x1 = sourceRect.right - viewRect.left + sourceOffset;
        y1 = sourceCenterY - viewRect.top + mapScroll.scrollTop;
        x2 = targetRect.left - viewRect.left;
        y2 = route.entryY;
        points = [
          [x1, y1],
          [sourceChannelX, y1],
          [sourceChannelX, route.routeY],
          [route.laneX, route.routeY],
          [route.laneX, y2],
          [x2, y2]
        ];
      } else {
        const sourceIsElective = Boolean(source.closest("#choice-shelf"));
        const sameColumn = !sourceIsElective && !target.closest("#choice-shelf") &&
          Math.abs(targetCenterX - sourceCenterX) < 8;

        if (sameColumn) {
          x1 = sourceCenterX - viewRect.left + horizontalOffset(source);
          y1 = (targetCenterY > sourceCenterY ? sourceRect.bottom : sourceRect.top) - viewRect.top + mapScroll.scrollTop;
          x2 = targetCenterX - viewRect.left + horizontalOffset(target);
          y2 = (targetCenterY > sourceCenterY ? targetRect.top : targetRect.bottom) - viewRect.top + mapScroll.scrollTop;
          points = [[x1, y1], [x1, y2]];
        } else if (sourceIsElective) {
          x1 = sourceCenterX - viewRect.left + horizontalOffset(source);
          y1 = sourceRect.top - viewRect.top + mapScroll.scrollTop;
          x2 = sourceCenterX - viewRect.left + horizontalOffset(target);
          y2 = targetRect.bottom - viewRect.top + mapScroll.scrollTop;
          const elbowY = (y1 + y2) / 2;
          points = [[x1, y1], [x1, elbowY], [x2, elbowY], [x2, y2]];
        } else {
          const flowsRight = targetCenterX > sourceCenterX;
          x1 = (flowsRight ? sourceRect.right : sourceRect.left) - viewRect.left + horizontalOffset(source);
          y1 = sourceCenterY - viewRect.top + mapScroll.scrollTop;
          x2 = (flowsRight ? targetRect.left : targetRect.right) - viewRect.left + horizontalOffset(target);
          y2 = targetCenterY - viewRect.top + mapScroll.scrollTop;
          const elbowX = (x1 + x2) / 2;
          points = [[x1, y1], [elbowX, y1], [elbowX, y2], [x2, y2]];
        }
      }

      const forward = targetCode === state.focusedCourse || path.descendants.has(targetCode);
      const route = roundedConnectorPath(points);
      paths.push(`<path class="connector-path${forward ? " forward" : " upstream"}${targetIsElective ? " elective-path" : ""}" data-source-course="${escapeHtml(sourceCode)}" data-target-course="${escapeHtml(targetCode)}" marker-end="url(#map-arrow-${forward ? "forward" : "upstream"})" d="${route}"/>`);
    }

    svg.innerHTML = `<defs>
      <marker id="map-arrow-forward" markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7 Z" fill="var(--primary)"/></marker>
      <marker id="map-arrow-upstream" markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7 Z" fill="var(--ink-muted)"/></marker>
    </defs>${paths.join("")}`;

  }

  function roundedConnectorPath(points) {
    const compact = points.filter((point, index) =>
      index === 0 || point[0] !== points[index - 1][0] || point[1] !== points[index - 1][1]
    );
    if (compact.length < 2) return "";
    let path = `M ${compact[0][0]} ${compact[0][1]}`;
    for (let index = 1; index < compact.length - 1; index += 1) {
      const previous = compact[index - 1];
      const current = compact[index];
      const next = compact[index + 1];
      const incomingLength = Math.hypot(current[0] - previous[0], current[1] - previous[1]);
      const outgoingLength = Math.hypot(next[0] - current[0], next[1] - current[1]);
      const radius = Math.min(7, incomingLength / 2, outgoingLength / 2);
      const before = [
        current[0] + (previous[0] - current[0]) / incomingLength * radius,
        current[1] + (previous[1] - current[1]) / incomingLength * radius
      ];
      const after = [
        current[0] + (next[0] - current[0]) / outgoingLength * radius,
        current[1] + (next[1] - current[1]) / outgoingLength * radius
      ];
      path += ` L ${before[0]} ${before[1]} Q ${current[0]} ${current[1]} ${after[0]} ${after[1]}`;
    }
    const end = compact[compact.length - 1];
    return `${path} L ${end[0]} ${end[1]}`;
  }

  function mapDependents(code) {
    return [...(courseDependents.get(code) || [])].filter((dependentCode) =>
      state.mapProgramCourses?.has(dependentCode)
    );
  }

  function hasAlternatePath(sourceCode, targetCode) {
    const pending = mapDependents(sourceCode).filter((code) => code !== targetCode);
    const visited = new Set([sourceCode]);
    while (pending.length) {
      const code = pending.pop();
      if (code === targetCode) return true;
      if (visited.has(code)) continue;
      visited.add(code);
      pending.push(...mapDependents(code));
    }
    return false;
  }

  function reducedDependents(code) {
    return mapDependents(code).filter((dependentCode) => !hasAlternatePath(code, dependentCode));
  }

  function orderSemesterCourses(grouped) {
    const semesterByCode = new Map();
    const positions = new Map();
    for (const [semester, group] of grouped) {
      group.forEach((course, index) => {
        semesterByCode.set(course.kode, semester);
        positions.set(course.kode, index);
      });
    }

    const reorder = (semester, neighborCodes) => {
      const group = grouped.get(semester);
      const scores = new Map(group.map((course) => {
        const neighbors = neighborCodes(course.kode)
          .filter((code) => semesterByCode.get(code) !== undefined)
          .map((code) => positions.get(code));
        return [course.kode, neighbors.length
          ? neighbors.reduce((sum, position) => sum + position, 0) / neighbors.length
          : positions.get(course.kode)];
      }));
      group.sort((a, b) => scores.get(a.kode) - scores.get(b.kode));
      group.forEach((course, index) => positions.set(course.kode, index));
    };

    for (let pass = 0; pass < 3; pass += 1) {
      for (let semester = 2; semester <= 8; semester += 1) {
        reorder(semester, (code) => getRequirements(byCode.get(code))
          .filter((requirement) => requirement.course && semesterByCode.get(requirement.course.kode) < semester)
          .map((requirement) => requirement.course.kode));
      }
      for (let semester = 7; semester >= 1; semester -= 1) {
        reorder(semester, (code) => mapDependents(code)
          .filter((dependentCode) => semesterByCode.get(dependentCode) > semester));
      }
    }
  }

  function getCoursePath(code) {
    const ancestors = new Set();
    const descendants = new Set();
    const visit = (node, links, visited) => {
      for (const next of links(node) || []) {
        if (!state.mapProgramCourses?.has(next)) continue;
        if (visited.has(next)) continue;
        visited.add(next);
        visit(next, links, visited);
      }
    };
    if (code && byCode.has(code)) {
      visit(code, (node) => getRequirements(byCode.get(node)).filter((item) => item.course).map((item) => item.course.kode), ancestors);
      visit(code, mapDependents, descendants);
    }
    const all = new Set([...(code ? [code] : []), ...ancestors, ...descendants]);
    return { ancestors, descendants, all };
  }

  function updatePathSelection() {
    const selectedCourse = byCode.get(state.focusedCourse);
    const path = getCoursePath(state.focusedCourse);
    const forwardCount = [...path.descendants].filter((courseCode) => state.mapProgramCourses?.has(courseCode)).length;
    const previousCount = [...path.ancestors].filter((courseCode) => state.mapProgramCourses?.has(courseCode)).length;
    const selection = $("#path-selection");
    selection.hidden = !selectedCourse;
    if (!selectedCourse) return;
    $("#path-selection-title").textContent = selectedCourse.nama;
    $("#path-selection-meta").textContent = `${previousCount} prasyarat sebelumnya · ${forwardCount} mata kuliah lanjutan`;
  }

  function focusCourse(code) {
    state.focusedCourse = code;
    const path = getCoursePath(state.focusedCourse);
    document.querySelectorAll("#map-grid [data-course], #choice-grid [data-course]").forEach((card) => {
      const selected = card.dataset.course === state.focusedCourse;
      const upstream = path.ancestors.has(card.dataset.course);
      const downstream = path.descendants.has(card.dataset.course);
      card.classList.toggle("is-target", selected);
      card.classList.toggle("is-upstream", upstream);
      card.classList.toggle("is-downstream", downstream);
      card.classList.toggle("is-highlighted", upstream || downstream);
      card.classList.toggle("is-dimmed", Boolean(state.focusedCourse) && !path.all.has(card.dataset.course));
    });
    updatePathSelection();
    drawConnectors();
  }

  function highlightCourse(code) {
    const card = document.querySelector(`#map-grid [data-course="${CSS.escape(code)}"], #choice-grid [data-course="${CSS.escape(code)}"]`);
    if (!card) return;
    state.flippedCourse = code;
    focusCourse(code);
    document.querySelectorAll(".course-card").forEach((item) => {
      const isOpen = item.dataset.course === code;
      item.classList.toggle("is-flipped", isOpen);
      item.querySelector(".course-focus-button")?.setAttribute("aria-expanded", String(isOpen));
    });
    card.querySelector(".course-card-back")?.setAttribute("aria-hidden", "false");
    card.querySelector(".flip-close")?.focus();
    document.querySelectorAll(".course-card-back").forEach((back) => {
      if (back.closest("[data-course]")?.dataset.course !== code) back.setAttribute("aria-hidden", "true");
    });
    card.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  }

  function toggleCourseCard(code) {
    const opening = state.flippedCourse !== code;
    state.flippedCourse = opening ? code : null;
    document.querySelectorAll(".course-card").forEach((item) => {
      const isOpen = opening && item.dataset.course === code;
      item.classList.toggle("is-flipped", isOpen);
      item.querySelector(".course-focus-button")?.setAttribute("aria-expanded", String(isOpen));
    });
    if (opening) {
      focusCourse(code);
      const card = document.querySelector(`[data-course="${CSS.escape(code)}"]`);
      card?.querySelector(".course-card-back")?.setAttribute("aria-hidden", "false");
      card?.querySelector(".flip-close")?.focus();
      card?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
    document.querySelectorAll(".course-card-back").forEach((back) => {
      back.setAttribute("aria-hidden", String(!opening || back.closest("[data-course]")?.dataset.course !== code));
    });
  }

  function clearCoursePath() {
    state.focusedCourse = null;
    state.flippedCourse = null;
    document.querySelectorAll(".course-card").forEach((card) => {
      card.classList.remove("is-flipped");
      card.querySelector(".course-focus-button")?.setAttribute("aria-expanded", "false");
      card.querySelector(".course-card-back")?.setAttribute("aria-hidden", "true");
      card.classList.remove("is-target", "is-upstream", "is-downstream", "is-highlighted", "is-dimmed");
    });
    updatePathSelection();
    drawConnectors();
  }

  function renderPassedResults() {
    const query = normalize(state.passedQuery);
    const available = courses.filter((course) => !state.passed.has(course.kode) &&
      (!query || normalize(`${course.kode} ${course.nama}`).includes(query))).slice(0, 14);
    $("#passed-results").innerHTML = available.length
      ? available.map((course) => `
        <label class="result-row">
          <input type="checkbox" data-pass-course="${escapeHtml(course.kode)}" aria-label="Tandai ${escapeHtml(course.nama)} sudah lulus">
          <span class="result-main"><strong>${escapeHtml(course.nama)}</strong><small>${escapeHtml(course.kode)} · ${escapeHtml(course.sks)} SKS</small></span>
        </label>`).join("")
      : `<p class="panel-empty">${query ? "Tidak ada hasil. Coba kata kunci lain." : "Semua mata kuliah sudah ditandai lulus."}</p>`;
    $("#passed-results").querySelectorAll("[data-pass-course]").forEach((input) => {
      input.addEventListener("change", () => {
        if (input.checked) state.passed.add(input.dataset.passCourse);
        else state.passed.delete(input.dataset.passCourse);
        if (input.checked) {
          state.plans.forEach((plan) => {
            plan.courses = plan.courses.filter((code) => code !== input.dataset.passCourse);
          });
        }
        renderPlanner();
        savePlans();
      });
    });
    const passedCourses = [...state.passed].map((code) => byCode.get(code)).filter(Boolean);
    $("#passed-count").textContent = String(passedCourses.length);
    $("#passed-credits").textContent = String(completedCredits());
    $("#passed-chips").innerHTML = passedCourses.length
      ? passedCourses.map((course) => `<span class="passed-chip">${escapeHtml(course.nama)} <button type="button" data-unpass="${escapeHtml(course.kode)}" aria-label="Hapus ${escapeHtml(course.nama)} dari mata kuliah lulus">×</button></span>`).join("")
      : '<p class="no-selection">Belum ada mata kuliah yang ditandai.</p>';
    $("#passed-chips").querySelectorAll("[data-unpass]").forEach((button) => {
      button.addEventListener("click", () => {
        state.passed.delete(button.dataset.unpass);
        renderPlanner();
        savePlans();
      });
    });
  }

  function renderCourseOptions() {
    const query = normalize(state.courseQuery);
    const planned = allPlannedCodes();
    let filtered = courses.filter((course) => {
      if (state.passed.has(course.kode) || planned.has(course.kode)) return false;
      const isExternal = externalToProgram(course);
      if (state.courseScope === "program" && isExternal) return false;
      if (state.courseScope === "external" && !isExternal) return false;
      return !query || normalize(`${course.kode} ${course.nama} ${course.kategori}`).includes(query);
    });
    $("#catalog-count").textContent = String(filtered.length);
    $("#course-results").innerHTML = filtered.length
      ? filtered.map((course) => renderCourseOption(course)).join("")
      : '<p class="panel-empty">Tidak ada mata kuliah yang cocok dengan pencarian ini.</p>';
    $("#course-results").querySelectorAll("[data-manual-check]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) state.manualChecks.add(checkbox.dataset.manualCheck);
        else state.manualChecks.delete(checkbox.dataset.manualCheck);
        renderPlanner();
        savePlans();
      });
    });
    $("#course-results").querySelectorAll("[data-add-course]").forEach((button) => {
      button.addEventListener("click", () => addCourse(button.dataset.addCourse));
    });
  }

  function renderCourseOption(course) {
    const status = eligibility(course);
    const external = externalToProgram(course);
    const plan = activePlan();
    const planLimit = maxCreditsForGpa(plan.gpa);
    const plannedCredits = plan.courses.reduce((sum, code) => sum + (byCode.get(code)?.sks || 0), 0);
    const exceedsLimit = planLimit === null || plannedCredits + course.sks > planLimit;
    const canAdd = status.eligible && !exceedsLimit;
    const tags = [
      `<span class="mini-tag">${escapeHtml(shortCategory(course))}</span>`,
      `<span class="mini-tag">${isElective(course) ? "Pilihan · semester fleksibel" : `Semester ${escapeHtml(course.semester)}`}</span>`,
      ...(external ? ['<span class="mini-tag external">Lintas prodi</span>'] : [])
    ].join("");
    const reqHtml = status.requirements.length
      ? `<div class="option-prereqs"><strong>Prasyarat</strong>${status.requirements.map((requirement) => {
        const check = requirementState(course, requirement);
        if (check.manual) {
          return `<label class="manual-requirement"><input type="checkbox" data-manual-check="${escapeHtml(check.key)}"${check.complete ? " checked" : ""}><span>Verifikasi manual: ${escapeHtml(check.text)}</span></label>`;
        }
        const status = check.planned ? "Direncanakan" : check.complete ? "Lulus" : "Belum lulus";
        const statusClass = check.planned ? "planned" : check.complete ? "good" : "warning";
        return `<span class="mini-tag ${statusClass}">${status} · ${escapeHtml(check.text)}</span>`;
      }).join("")}</div>`
      : '<div class="option-prereqs"><strong>Prasyarat</strong><span class="mini-tag good">Tidak ada prasyarat</span></div>';
    const missingCourse = status.missing.some((item) => !item.status.manual);
    const unknownMissing = status.missing.some((item) => item.status.manual);
    let explanation = "Siap ditambahkan.";
    if (missingCourse) explanation = "Luluskan prasyarat sebelum menambahkan.";
    else if (unknownMissing) explanation = "Verifikasi syarat manual untuk melanjutkan.";
    else if (exceedsLimit) explanation = planLimit === null ? "Isi IP untuk menghitung batas SKS." : "Melewati batas SKS semester.";
    return `
      <article class="course-option">
        <div class="option-heading">
          <div class="option-title-group"><strong>${escapeHtml(course.nama)}</strong><small>${escapeHtml(course.kode)} · ${escapeHtml(course.sks)} SKS</small></div>
          <span class="option-sks">${escapeHtml(course.sks)} SKS</span>
        </div>
        <div class="option-meta">${tags}</div>
        ${reqHtml}
        <div class="option-footer">
          <span class="status-text${canAdd ? "" : " blocked"}">${escapeHtml(explanation)}</span>
          <button class="add-course" type="button" data-add-course="${escapeHtml(course.kode)}"${canAdd ? "" : " disabled"}>Tambah +</button>
        </div>
      </article>`;
  }

  function renderPlan() {
    const plan = activePlan();
    const plannedCourses = plan.courses.map((code) => byCode.get(code)).filter(Boolean);
    const total = plannedCourses.reduce((sum, course) => sum + (course.sks || 0), 0);
    const limit = maxCreditsForGpa(plan.gpa);
    const currentIndex = state.plans.findIndex((item) => item.id === plan.id);
    $("#current-semester-title").textContent = plan.title;
    $("#current-semester-meta").textContent = `${plannedCourses.length} mata kuliah · ${total} SKS`;
    $("#planner-gpa").value = plan.gpa;
    $("#semester-plan-list").innerHTML = state.plans.map((item, index) => {
      const itemCourses = item.courses.map((code) => byCode.get(code)).filter(Boolean);
      const itemCredits = itemCourses.reduce((sum, course) => sum + (course.sks || 0), 0);
      return `<button class="semester-plan-tab${item.id === plan.id ? " active" : ""}" type="button" data-select-plan="${escapeHtml(item.id)}" aria-pressed="${item.id === plan.id}">
        <span class="semester-tab-index">${String(index + 1).padStart(2, "0")}</span>
        <span class="semester-tab-copy"><strong>${escapeHtml(item.title)}</strong><small>${itemCourses.length} mata kuliah · ${itemCredits} SKS</small></span>
      </button>`;
    }).join("");
    $("#semester-plan-list").querySelectorAll("[data-select-plan]").forEach((button) => {
      button.addEventListener("click", () => {
        state.currentPlanId = button.dataset.selectPlan;
        renderPlanner();
        savePlans();
      });
    });
    $("#plan-count").textContent = String(plannedCourses.length);
    $("#planned-credits").textContent = `${total} SKS`;
    $("#meter-limit").textContent = `dari ${limit === null ? "—" : `${limit} SKS`}`;
    $("#plan-total-credits").textContent = String(total);
    $("#plan-total-limit").textContent = limit === null ? "—" : String(limit);
    $("#meter-fill").style.width = `${limit === null || limit === 0 ? 0 : Math.min(100, total / limit * 100)}%`;
    $("#meter-fill").classList.toggle("over", limit !== null && total > limit);
    $("#plan-list").innerHTML = plannedCourses.map((course) => `
      <div class="planned-course">
        <span class="planned-course-info"><strong>${escapeHtml(course.nama)}</strong><small>${escapeHtml(course.kode)}${externalToProgram(course) ? " · Lintas prodi" : ""}</small></span>
        <span class="planned-sks">${escapeHtml(course.sks)} SKS</span>
        <button class="remove-course" type="button" data-remove-course="${escapeHtml(course.kode)}" aria-label="Hapus ${escapeHtml(course.nama)} dari rencana">×</button>
      </div>`).join("");
    $("#plan-empty").hidden = plannedCourses.length > 0;
    const manualRequirements = plannedCourses.flatMap((course) => eligibility(course).missing)
      .filter((item) => item.status.manual).map((item) => item.status.text);
    const overLimit = limit !== null && total > limit;
    $("#plan-warning").hidden = !(overLimit || manualRequirements.length);
    $("#plan-warning").textContent = overLimit
      ? `Rencana melebihi batas IP sebesar ${total - limit} SKS. Hapus beberapa mata kuliah atau perbarui IP acuan.`
      : manualRequirements.length
        ? "Ada prasyarat yang perlu verifikasi manual. Pastikan syarat tersebut terpenuhi sebelum mengambil mata kuliah."
        : "";
    $("#plan-list").querySelectorAll("[data-remove-course]").forEach((button) => {
      button.addEventListener("click", () => {
        plan.courses = plan.courses.filter((code) => code !== button.dataset.removeCourse);
        renderPlanner();
        savePlans();
      });
    });
    const addSemesterButton = $("#add-semester");
    addSemesterButton.disabled = state.plans.length >= 16;
    addSemesterButton.title = addSemesterButton.disabled ? "Maksimal 16 semester dalam satu rencana" : "Buat rencana semester berikutnya";
    $("#reset-planner").textContent = "Hapus rencana";
  }

  function renderGpa() {
    const input = $("#planner-gpa");
    const plan = activePlan();
    const limit = maxCreditsForGpa(plan.gpa);
    const container = $("#credit-limit");
    container.classList.toggle("invalid", input.value !== "" && limit === null);
    $("#max-credits").textContent = limit === null ? "—" : String(limit);
    $("#limit-caption").textContent = limit === null
      ? (plan.gpa === "" ? "Masukkan IP untuk menghitung" : "IP harus di antara 0,00 dan 4,00")
      : `IP ${Number(plan.gpa).toFixed(2)} · batas SKS mengikuti ketentuan`;
  }

  function renderPlanner() {
    renderGpa();
    renderPassedResults();
    renderCourseOptions();
    renderPlan();
  }

  function addCourse(code) {
    const course = byCode.get(code);
    if (!course || !eligibility(course).eligible) return;
    const plan = activePlan();
    const limit = maxCreditsForGpa(plan.gpa);
    const currentCredits = plan.courses.reduce((sum, plannedCode) => sum + (byCode.get(plannedCode)?.sks || 0), 0);
    if (limit === null || currentCredits + course.sks > limit) return;
    plan.courses.push(code);
    renderPlanner();
    savePlans();
  }

  function setView(view) {
    state.view = view;
    $("#map-view").hidden = view !== "map";
    $("#planner-view").hidden = view !== "planner";
    document.querySelectorAll(".mode-tab").forEach((button) => {
      const active = button.dataset.view === view;
      button.classList.toggle("active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    if (view === "map") drawConnectors();
  }

  function bindEvents() {
    document.querySelectorAll(".mode-tab").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
    $("#clear-path").addEventListener("click", clearCoursePath);
    $("#map-programs").querySelectorAll("[data-program]").forEach((button) => {
      button.addEventListener("click", () => {
        state.mapProgram = button.dataset.program;
        state.focusedCourse = null;
        $("#map-programs").querySelectorAll(".program-choice").forEach((choice) => {
          const active = choice === button;
          choice.classList.toggle("active", active);
          choice.setAttribute("aria-pressed", String(active));
        });
        renderMap();
      });
    });
    $("#planner-program").addEventListener("change", (event) => {
      state.plannerProgram = event.target.value;
      renderPlanner();
      savePlans();
    });
    $("#planner-gpa").addEventListener("input", (event) => {
      activePlan().gpa = event.target.value;
      renderPlanner();
      savePlans();
    });
    $("#passed-search").addEventListener("input", (event) => {
      state.passedQuery = event.target.value;
      renderPassedResults();
    });
    $("#course-search").addEventListener("input", (event) => {
      state.courseQuery = event.target.value;
      renderCourseOptions();
    });
    $("#course-scope").addEventListener("change", (event) => {
      state.courseScope = event.target.value;
      renderCourseOptions();
    });
    $("#add-semester").addEventListener("click", () => {
      if (state.plans.length >= 16) return;
      const plan = createPlan(state.plans.length + 1);
      state.plans.push(plan);
      state.currentPlanId = plan.id;
      renderPlanner();
      savePlans();
      $("#planner-gpa").focus();
    });
    $("#save-plan").addEventListener("click", () => savePlans(true));
    $("#reset-planner").addEventListener("click", () => {
      if (!window.confirm("Hapus semua progres dan rencana semester yang tersimpan di perangkat ini?")) return;
      state.passed.clear();
      state.plans = [createPlan(1)];
      state.currentPlanId = state.plans[0].id;
      state.manualChecks.clear();
      $("#planner-gpa").value = "";
      $("#passed-search").value = "";
      $("#course-search").value = "";
      $("#course-scope").value = "all";
      state.passedQuery = "";
      state.courseQuery = "";
      state.courseScope = "all";
      renderPlanner();
      savePlans(true);
    });
    $("#theme-toggle").addEventListener("click", () => {
      state.theme = state.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = state.theme;
      $("#theme-toggle").setAttribute("aria-label", state.theme === "dark" ? "Ganti ke tema terang" : "Ganti ke tema gelap");
      $("#theme-toggle").innerHTML = state.theme === "dark"
        ? '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="3.4"/><path d="M10 1.5v2M10 16.5v2M18.5 10h-2M3.5 10h-2m14.5-6-1.4 1.4m-9.2 9.2L4 16m12 0-1.4-1.4m-9.2-9.2L4 4"/></svg>'
        : '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16.7 12.4A7 7 0 0 1 7.6 3.3 7 7 0 1 0 16.7 12.4Z"/></svg>';
      try {
        localStorage.setItem("theme", state.theme);
      } catch (error) {
        console.error("Preferensi tema tidak dapat disimpan.", error);
      }
    });
    window.addEventListener("resize", () => requestAnimationFrame(drawConnectors));
    $("#map-scroll").addEventListener("scroll", drawConnectors, { passive: true });
    if ("ResizeObserver" in window) new ResizeObserver(() => requestAnimationFrame(drawConnectors)).observe($("#map-grid"));
  }

  function initialize() {
    if (!courses.length) {
      $("#map-grid").innerHTML = '<p class="empty-map">Data kurikulum tidak berhasil dimuat. Periksa kembali file data/kurikulum.js.</p>';
      $("#course-results").innerHTML = '<p class="panel-empty">Data kurikulum tidak tersedia.</p>';
      return;
    }
    try {
      state.theme = localStorage.getItem("theme") === "dark" ? "dark" : "light";
    } catch (error) {
      console.error("Preferensi tema tidak dapat dibaca.", error);
    }
    document.documentElement.dataset.theme = state.theme;
    $("#theme-toggle").setAttribute("aria-label", state.theme === "dark" ? "Ganti ke tema terang" : "Ganti ke tema gelap");
    if (state.theme === "dark") {
      $("#theme-toggle").innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="3.4"/><path d="M10 1.5v2M10 16.5v2M18.5 10h-2M3.5 10h-2m14.5-6-1.4 1.4m-9.2 9.2L4 16m12 0-1.4-1.4m-9.2-9.2L4 4"/></svg>';
    }
    restoreProgress();
    state.currentPlanId = state.currentPlanId || state.plans[0].id;
    $("#planner-program").value = state.plannerProgram;
    bindEvents();
    renderMap();
    renderPlanner();
    savePlans();
  }

  initialize();
})();
