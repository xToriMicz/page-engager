const { app, BrowserWindow, shell, dialog } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

let mainWindow;
let serverProcess;
const PORT = 3000;

// Check if .env exists, create from example if not
function ensureEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  const examplePath = path.join(__dirname, "..", ".env.example");
  if (!fs.existsSync(envPath) && fs.existsSync(examplePath)) {
    fs.copyFileSync(examplePath, envPath);
  }
}

// Start the backend server
function startServer() {
  return new Promise((resolve, reject) => {
    const serverPath = path.join(__dirname, "..", "src", "server", "index.ts");
    serverProcess = spawn("npx", ["tsx", serverPath], {
      cwd: path.join(__dirname, ".."),
      env: { ...process.env, HEADLESS: "true", NODE_ENV: "production" },
      shell: true,
    });

    serverProcess.stdout.on("data", (data) => {
      const msg = data.toString();
      console.log("[server]", msg.trim());
      if (msg.includes("running on")) resolve();
    });

    serverProcess.stderr.on("data", (data) => {
      console.error("[server]", data.toString().trim());
    });

    serverProcess.on("error", reject);

    // Timeout — resolve anyway after 10s
    setTimeout(resolve, 10000);
  });
}

// Create the main window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "Page Engager",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 12, y: 12 },
    backgroundColor: "#0a0a0a",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load the built frontend or dev server
  const distIndex = path.join(__dirname, "..", "dist", "web", "index.html");
  if (fs.existsSync(distIndex)) {
    // Production — serve built files via the backend
    mainWindow.loadURL(`http://localhost:${PORT}`);
  } else {
    // Development — use Vite dev server
    mainWindow.loadURL("http://localhost:5173");
  }

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes("facebook.com")) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// App lifecycle
app.whenReady().then(async () => {
  ensureEnv();

  // Check for API key
  const envContent = fs.readFileSync(path.join(__dirname, "..", ".env"), "utf-8");
  if (envContent.includes("sk-ant-your-key-here")) {
    const result = await dialog.showMessageBox({
      type: "info",
      title: "Setup Required",
      message: "Anthropic API Key needed",
      detail: "Please set your ANTHROPIC_API_KEY in the .env file.\n\nGet your key from: https://console.anthropic.com/",
      buttons: ["Open .env", "Continue anyway"],
    });
    if (result.response === 0) {
      shell.openPath(path.join(__dirname, "..", ".env"));
    }
  }

  console.log("Starting server...");
  await startServer();
  console.log("Server started, opening window...");
  createWindow();
});

app.on("window-all-closed", () => {
  if (serverProcess) {
    serverProcess.kill();
  }
  app.quit();
});

app.on("activate", () => {
  if (mainWindow === null) createWindow();
});

app.on("before-quit", () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});
