const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1540,
    height: 980,
    minWidth: 1100,
    minHeight: 760,
    backgroundColor: "#f5f7f4",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildPrintableLessonHtml(lesson) {
  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>${escapeHtml(lesson.title || "Lesson Plan")}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; color: #1f2937; line-height: 1.6; }
        .header { margin-bottom: 24px; padding-bottom: 18px; border-bottom: 2px solid #d1d5db; }
        h1 { margin: 0 0 6px; font-size: 28px; }
        .meta { color: #6b7280; font-size: 14px; }
        section { margin-bottom: 22px; }
        h2 { margin: 0 0 8px; font-size: 18px; }
        p { margin: 0; white-space: pre-wrap; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${escapeHtml(lesson.title || "Untitled lesson")}</h1>
        <div class="meta">
          Scheduled: ${escapeHtml(lesson.scheduledLabel || "")}<br />
          Status: ${escapeHtml(lesson.status || "planned")}<br />
          Updated: ${escapeHtml(lesson.updatedLabel || "")}
        </div>
      </div>
      <section><h2>Objectives</h2><p>${escapeHtml(lesson.objectives || "")}</p></section>
      <section><h2>Activities</h2><p>${escapeHtml(lesson.activities || "")}</p></section>
      <section><h2>Assessment</h2><p>${escapeHtml(lesson.assessment || "")}</p></section>
    </body>
  </html>`;
}

async function exportLessonPdf(_, lesson) {
  const tempWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true
    }
  });

  try {
    await tempWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildPrintableLessonHtml(lesson))}`);
    const pdfData = await tempWindow.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      pageSize: "A4"
    });

    const safeName = (lesson.title || "lesson-plan").replace(/[<>:"/\\|?*]+/g, "-");
    const defaultPath = path.join(os.homedir(), "Downloads", `${safeName}.pdf`);
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: "Export lesson to PDF",
      defaultPath,
      filters: [{ name: "PDF", extensions: ["pdf"] }]
    });

    if (canceled || !filePath) {
      return { canceled: true };
    }

    await fs.writeFile(filePath, pdfData);
    return { canceled: false, filePath };
  } finally {
    tempWindow.destroy();
  }
}

function buildFallbackLesson({ topic, audience, context }) {
  const topicLabel = topic?.trim() || "Untitled topic";
  const audienceLabel = audience?.trim() || "learners";
  const contextLabel = context?.trim() || "balanced direct instruction and active practice";

  return {
    title: `${topicLabel} lesson plan`,
    objectives: [
      `Identify the core ideas and vocabulary related to ${topicLabel}.`,
      `Explain the topic clearly using examples appropriate for ${audienceLabel}.`,
      `Apply understanding of ${topicLabel} in a short guided task or discussion.`
    ].join("\n"),
    activities: [
      `Launch with a short hook that surfaces prior knowledge about ${topicLabel}.`,
      `Model or explain the key concept with visuals, examples, or teacher think-alouds.`,
      `Move into partner or small-group work using ${contextLabel}.`,
      `Close with a reflection, exit ticket, or share-out summarizing the main takeaway.`
    ].join("\n"),
    assessment: [
      "Use quick checks for understanding during the lesson.",
      `Collect a short written or verbal explanation of ${topicLabel}.`,
      "Review the exit ticket to decide who needs reteaching or enrichment next."
    ].join("\n"),
    source: "smart-template"
  };
}

async function generateLesson(_, payload) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return buildFallbackLesson(payload);
  }

  const prompt = [
    "Create a concise lesson plan draft as JSON with keys: title, objectives, activities, assessment.",
    "Write practical classroom-ready content.",
    `Topic: ${payload.topic || ""}`,
    `Audience: ${payload.audience || ""}`,
    `Teacher note: ${payload.context || ""}`
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: prompt,
      text: {
        format: {
          type: "json_schema",
          name: "lesson_plan",
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["title", "objectives", "activities", "assessment"],
            properties: {
              title: { type: "string" },
              objectives: { type: "string" },
              activities: { type: "string" },
              assessment: { type: "string" }
            }
          }
        }
      }
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`OpenAI request failed: ${message}`);
  }

  const data = await response.json();
  const content = data.output?.[0]?.content?.[0]?.text || "{}";
  const parsed = JSON.parse(content);

  return {
    ...parsed,
    source: "openai"
  };
}

ipcMain.handle("eduplan:export-pdf", exportLessonPdf);
ipcMain.handle("eduplan:generate-lesson", generateLesson);
