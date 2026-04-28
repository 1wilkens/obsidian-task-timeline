// Task Timeline – DataviewJS view for Obsidian
// Usage: ```dataviewjs await dv.view("_tasks/view/view") ```

// ── Configuration ──────────────────────────────────────────────
const defaultFolder = app.vault.getConfig?.("newFileLocation") === "folder"
    ? (app.vault.getConfig?.("newFileFolderPath") || "")
    : "";
const CONFIG = Object.assign(
    { folder: defaultFolder, format: "YYYY-MM-DD", tasksHeading: "Tasks", pages: "", inbox: "" },
    input || {}
);

// Auto-detect from daily-notes / periodic-notes plugins (overrides defaults, not explicit input)
try {
    const plugin = app.internalPlugins?.getPluginById?.("daily-notes");
    if (plugin?.enabled) {
        const opts = plugin.instance?.options;
        if (opts?.folder && !input?.folder) CONFIG.folder = opts.folder;
        if (opts?.format && !input?.format) CONFIG.format = opts.format;
    }
} catch {}
try {
    const pn = app.plugins?.plugins?.["periodic-notes"];
    if (pn?.settings?.daily) {
        if (pn.settings.daily.folder && !input?.folder) CONFIG.folder = pn.settings.daily.folder;
        if (pn.settings.daily.format && !input?.format) CONFIG.format = pn.settings.daily.format;
    }
} catch {}

const DAILY_FOLDER = CONFIG.folder;
const DAILY_FORMAT = CONFIG.format;
const TASKS_HEADING = CONFIG.tasksHeading;

const ICONS = {
    calendar: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    hourglass: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 1 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/></svg>',
    folder: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
    "file-text": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
    "corner-down-left": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 10 4 15 9 20"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/></svg>',
    file: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>',
    tag: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
};
function setIcon(el, name) { if (ICONS[name]) el.innerHTML = ICONS[name]; }

// ── Pages scope ───────────────────────────────────────────────
function getPages() {
    const p = CONFIG.pages;
    if (!p) return dv.pages();
    if (p.startsWith("dv.pages")) return eval(p);
    return dv.pages(p);
}

// ── Helpers ────────────────────────────────────────────────────
const today = moment().startOf("day");

function dvDate(d) {
    if (!d) return null;
    if (d.ts != null) return moment(d.ts);
    return moment(String(d));
}

function stripMeta(text) {
    return text
        .replace(/[📅⏳🛫✅]\s*\d{4}-\d{2}-\d{2}/gu, "")
        .replace(/🔁[^\s📅⏳🛫✅]*/gu, "")
        .replace(/[⏫🔼🔽⏬]/gu, "")
        .replace(/\[(due|scheduled|start|completion|created)::[^\]]*\]/g, "")
        .trim();
}

function relDay(m) {
    const d = m.clone().startOf("day").diff(today, "days");
    if (d === 0) return "today";
    if (d === 1) return "in a day";
    if (d === -1) return "yesterday";
    return d > 0 ? `in ${d} days` : `${Math.abs(d)} days ago`;
}

function taskSource(t) {
    const name = t.path.replace(/\.md$/, "").split("/").pop();
    const h = t.section?.subpath;
    return h ? `${name} > ${h}` : name;
}

function extractTags(text) {
    const tags = [];
    const stripped = text
        .replace(/#[^\s#\[\]!"'()*,;:]+/g, m => { tags.push(m); return ""; })
        .replace(/\s{2,}/g, " ")
        .trim();
    return { text: stripped, tags };
}

function renderTextWithLinks(el, text) {
    const parts = text.split(/(\[\[[^\]]+\]\])/);
    for (const part of parts) {
        const m = part.match(/^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/);
        if (m) {
            const target = m[1].trim();
            const display = m[2] ? m[2].trim() : target.split("/").pop();
            const link = el.createEl("span", { cls: "task-timeline-wikilink", text: display });
            link.addEventListener("click", e => {
                e.stopPropagation();
                app.workspace.openLinkText(target, "");
            });
        } else if (part) {
            el.appendText(part);
        }
    }
}

function hasQualifyingSignal(t) {
    if (t.due != null || t.scheduled != null || t.start != null || t.completion != null) return true;
    const inboxPath = CONFIG.inbox
        ? (CONFIG.inbox.endsWith(".md") ? CONFIG.inbox : CONFIG.inbox + ".md")
        : "";
    if (inboxPath && t.path === inboxPath) return true;
    const fname = t.path.replace(/\.md$/, "").split("/").pop();
    return moment(fname, DAILY_FORMAT, true).isValid();
}

// ── Collect incomplete tasks ───────────────────────────────────
const all = [];
for (const page of getPages()) {
    for (const t of page.file.tasks.where(t => !t.completed && hasQualifyingSignal(t))) {
        const due = dvDate(t.due);
        const sched = dvDate(t.scheduled);
        const { text, tags } = extractTags(stripMeta(t.text));
        all.push({
            text,
            tags,
            due,
            sched,
            eff: due || sched,
            source: taskSource(t),
            path: t.path,
            line: t.line,
        });
    }
}

const buckets = {
    todo:      all.filter(t => t.eff && t.eff.isSameOrAfter(today, "day")),
    overdue:   all.filter(t => t.eff && t.eff.isBefore(today, "day")),
    unplanned: all.filter(t => !t.eff),
};

// ── Build UI ───────────────────────────────────────────────────
let activeFilter = "all";
const root = dv.container.createEl("div", { cls: "task-timeline" });

// — Header
const header = root.createEl("div", { cls: "task-timeline-header" });
header.createEl("div", { cls: "task-timeline-accent", text: today.format("ddd, MMM D") });
header.createEl("div", { cls: "task-timeline-title", text: "Today" });

// — Filter bar
const filterBar = root.createEl("div", { cls: "task-timeline-filters" });
const btnEls = {};

[["todo", "To Do"], ["overdue", "Overdue"], ["unplanned", "Unplanned"]].forEach(([key, label]) => {
    const btn = filterBar.createEl("button", { cls: "task-timeline-filter" });
    btn.createEl("div", { cls: "task-timeline-filter-count", text: String(buckets[key].length) });
    btn.createEl("div", { cls: "task-timeline-filter-label", text: label });
    btn.addEventListener("click", () => {
        activeFilter = activeFilter === key ? "all" : key;
        Object.entries(btnEls).forEach(([k, el]) =>
            el.classList.toggle("is-active", k === activeFilter)
        );
        renderList();
    });
    btnEls[key] = btn;
});

// — Quick-add
const qa = root.createEl("div", { cls: "task-timeline-quick-add" });
const qaHeader = qa.createEl("div", { cls: "task-timeline-qa-header" });
const dailyPath = DAILY_FOLDER
    ? `${DAILY_FOLDER}/${today.format(DAILY_FORMAT)}`
    : today.format(DAILY_FORMAT);

const bc = qaHeader.createEl("span", { cls: "task-timeline-breadcrumb" });
if (DAILY_FOLDER) {
    bc.appendText("\u2026 / ");
    const fi1 = bc.createEl("span"); setIcon(fi1, "folder");
    bc.appendText(" " + DAILY_FOLDER + " / ");
    const fi2 = bc.createEl("span"); setIcon(fi2, "file");
    bc.appendText(" " + today.format(DAILY_FORMAT));
} else {
    const fi1 = bc.createEl("span"); setIcon(fi1, "file");
    bc.appendText(" " + today.format(DAILY_FORMAT));
}
const enterEl = qaHeader.createEl("span", { cls: "task-timeline-enter-icon" });
setIcon(enterEl, "corner-down-left");

const inputEl = qa.createEl("input", {
    cls: "task-timeline-input",
    attr: { type: "text", placeholder: "Enter your tasks here" },
});

inputEl.addEventListener("keydown", async (e) => {
    if (e.key !== "Enter" || !inputEl.value.trim()) return;
    const taskText = inputEl.value.trim();
    const filePath = dailyPath + ".md";
    const file = app.vault.getAbstractFileByPath(filePath);

    if (!file) {
        await app.vault.create(
            filePath,
            `# ${today.format(DAILY_FORMAT)}\n\n## ${TASKS_HEADING}\n\n- [ ] ${taskText}\n`
        );
    } else {
        const content = await app.vault.read(file);
        const re = new RegExp(`(## ${TASKS_HEADING}[^\\n]*\\n)`);
        const match = content.match(re);
        if (match) {
            const idx = content.indexOf(match[0]) + match[0].length;
            await app.vault.modify(
                file,
                content.slice(0, idx) + `- [ ] ${taskText}\n` + content.slice(idx)
            );
        } else {
            await app.vault.modify(
                file,
                content.trimEnd() + `\n\n## ${TASKS_HEADING}\n\n- [ ] ${taskText}\n`
            );
        }
    }
    inputEl.value = "";
    new Notice(`Task added to ${filePath}`);
});

// — Task list
const listContainer = root.createEl("div", { cls: "task-timeline-list" });

function renderList() {
    listContainer.empty();
    const pool = activeFilter === "all" ? all : buckets[activeFilter];

    if (!pool.length) {
        listContainer.createEl("div", { cls: "task-timeline-empty", text: "No tasks" });
        return;
    }

    // Group by effective date (unplanned tasks go under today)
    const groups = new Map();
    for (const t of pool) {
        const key = t.eff ? t.eff.format("YYYY-MM-DD") : today.format("YYYY-MM-DD");
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(t);
    }

    for (const [dateKey, tasks] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        const dm = moment(dateKey);
        const section = listContainer.createEl("div", { cls: "task-timeline-section" });

        // Date header — skip for today (already shown in main header)
        if (!dm.isSame(today, "day")) {
            const dateCls = dm.isBefore(today, "day")
                ? "task-timeline-section-date is-overdue"
                : "task-timeline-section-date";
            section.createEl("div", { cls: dateCls, text: dm.format("ddd, MMM D") });
        }

        tasks.forEach((t, i) => {
            const isOverdue = t.eff && t.eff.isBefore(today, "day");
            const isOnly = tasks.length === 1;
            const clsList = ["task-timeline-task"];
            if (isOnly)              clsList.push("is-only");
            else if (i === 0)        clsList.push("is-first");
            else if (i === tasks.length - 1) clsList.push("is-last");
            if (isOverdue) clsList.push("is-overdue");
            const row = section.createEl("div", { cls: clsList.join(" ") });

            // Checkbox circle
            const cb = row.createEl("div", { cls: "task-timeline-cb" });
            if (isOverdue) {
                cb.classList.add("is-overdue");
                cb.createEl("span", { cls: "task-timeline-cb-icon", text: "!" });
            }
            cb.addEventListener("click", async () => {
                const f = app.vault.getAbstractFileByPath(t.path);
                if (!f) return;

                let leaf = app.workspace.getLeavesOfType("markdown")
                    .find(l => l.view?.file?.path === t.path);
                const openedNew = !leaf;

                if (!leaf) {
                    leaf = app.workspace.getLeaf("tab");
                    await leaf.openFile(f, { active: true });
                } else {
                    app.workspace.setActiveLeaf(leaf, { focus: true });
                }

                const editor = leaf.view?.editor;
                if (editor) {
                    editor.setCursor({ line: t.line, ch: 0 });
                    app.commands.executeCommandById("obsidian-tasks-plugin:toggle-done");
                    row.classList.add("is-done");
                }

                if (openedNew) {
                    await new Promise(r => setTimeout(r, 200));
                    leaf.detach();
                }
            });

            // Body
            const body = row.createEl("div", { cls: "task-timeline-task-body" });
            const textEl = body.createEl("div", { cls: "task-timeline-task-text" });
            renderTextWithLinks(textEl, t.text || t.source);

            const meta = body.createEl("div", { cls: "task-timeline-task-meta" });

            // Due / scheduled badge
            if (t.due) {
                const dueBadge = meta.createEl("span", { cls: "task-timeline-meta-badge task-timeline-due-badge" });
                setIcon(dueBadge, "calendar");
                dueBadge.appendText(" " + relDay(t.due));
            } else if (t.sched) {
                const schedBadge = meta.createEl("span", { cls: "task-timeline-meta-badge" });
                setIcon(schedBadge, "hourglass");
                schedBadge.appendText(" " + relDay(t.sched));
            }

            // Source link
            const srcEl = meta.createEl("span", { cls: "task-timeline-meta-badge task-timeline-meta-src" });
            setIcon(srcEl, "file-text");
            srcEl.appendText(" " + t.source);
            srcEl.addEventListener("click", () =>
                app.workspace.openLinkText(t.path, "")
            );

            // Tags (always last)
            for (const tag of t.tags) {
                const tagEl = meta.createEl("span", { cls: "task-timeline-meta-badge task-timeline-tag" });
                setIcon(tagEl, "tag");
                tagEl.appendText(" " + tag.slice(1));
            }
        });
    }
}

renderList();
