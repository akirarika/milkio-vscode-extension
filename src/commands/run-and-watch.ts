import * as vscode from "vscode";
import { getWorkspaceStates, runtime, states } from "../states";
import { generate } from "../uses/auto-generate";
import { debounce } from "lodash";
import { join } from "path";
import { readFile } from "fs/promises";
import { getEnv } from "../utils/get-env";
import { existsSync } from "node:fs";
import { load } from "js-toml";
import { MilkioConfig } from "./extension-menu";
import { homedir } from "node:os";

export const registerRunAndWatch = (context: vscode.ExtensionContext) => {
  const disposable = vscode.commands.registerCommand("milkio.run-and-watch", () => {
    const workspace = states.pull("activeProject") as vscode.WorkspaceFolder;
    const workspaceStates = getWorkspaceStates(workspace);
    startRunAndWatch(workspace, workspaceStates);
  });

  const startRunAndWatch = async (workspace: vscode.WorkspaceFolder, workspaceStates: ReturnType<typeof getWorkspaceStates>) => {
    if (!workspace || !workspaceStates) return;
    workspaceStates.publish("commandRunAndWatchReloading", true);
    const terminalName =
      states.pull("mode") === "multiple"
        ? `(${workspace.name}) Milkio Run & Watch`
        : `Milkio Run & Watch`;
    workspaceStates.publish("commandRunAndWatchTerminalName", terminalName);

    let safe = 0;
    while (safe < 16 && vscode.window.terminals.find((terminal) => terminal.name === terminalName) !== undefined) {
      ++safe;
      vscode.window.terminals.find((terminal) => terminal.name === terminalName)?.dispose();
    }

    const generatePromise = generate(workspace.uri, true, true);
    await vscode.window.withProgress(
      {
        title: "Milkio Generating..",
        cancellable: false,
        location: vscode.ProgressLocation.Notification,
      },
      (progress, token) => {
        return new Promise(async (resolve) => {
          await generatePromise;
          resolve(undefined);
        });
      }
    );

    const execute = debounce(async () => {
      // If there is no terminal launched at startup, launch one. This is not necessary for Milkio but to optimize user experience. Otherwise, when Milkio exits, the entire panel will also exit.
      if (vscode.window.terminals.length === 0) vscode.window.createTerminal({ cwd: workspace.uri.fsPath, env: { ...getEnv() } }).show();

      workspaceStates.publish("commandRunAndWatchReloading", false);
      const terminal = vscode.window.createTerminal({
        name: terminalName,
        cwd: workspace.uri.fsPath,
        iconPath: new vscode.ThemeIcon("symbol-method"),
        isTransient: true,
        env: { ...getEnv() },
      });

      let packageJson = await JSON.parse((await readFile(join(workspace.uri.fsPath, "package.json"))).toString());
      let command = packageJson?.scripts?.dev;
      if (!command) {
        vscode.window.showInformationMessage(
          'No ("scripts" -> "dev") found in package.json. You need to write this command to instruct how to start Milkio.'
        );
        return;
      }

      // Sometimes, a file creation occurs within VS Code, but Bun fails to locate it. By introducing a suitable delay, the issue can be mitigated.
      setTimeout(() => terminal.sendText(command), 1440);

      if (existsSync(join(workspace.uri.fsPath, "milkio.toml"))) {
        const milkioConfig = load(await readFile(join(workspace.uri.fsPath, "milkio.toml"), "utf-8")) as MilkioConfig;
        if (milkioConfig?.link?.projects) {
          for (const project of milkioConfig.link.projects) {
            if (!project.name || !project.script) continue;
            let projectCwd = "";
            if (!project.cwd) projectCwd = workspace.uri.fsPath;
            else if (project.cwd.startsWith("~/")) projectCwd = join(homedir(), project.cwd.slice(2));
            else if (project.cwd.startsWith("./") || project.cwd.startsWith("../")) projectCwd = join(workspace.uri.fsPath, project.cwd);
            else projectCwd = project.cwd;
            const terminalName =
              states.pull("mode") === "multiple"
                ? `(${workspace.name}) ${project.name}`
                : `${project.name}`;
            const oldTerminal = vscode.window.terminals.find((terminal) => terminal.name === terminalName);
            if (!oldTerminal) {
              const terminal = vscode.window.createTerminal({
                name: terminalName,
                cwd: projectCwd,
                iconPath: new vscode.ThemeIcon("symbol-method"),
                isTransient: true,
                env: { ...getEnv() },
              });
              terminal.sendText(`${project.script}`);
            }
          }
        }
      }
    }, 256);

    const unsubscribe1 = workspaceStates.subscribe("generating", async (e) => {
      if (!e.value) return;
      const oldTerminal = vscode.window.terminals.find((terminal) => terminal.name === terminalName);
      if (!oldTerminal) return;
      vscode.window.terminals.find((terminal) => terminal.name === terminalName)?.dispose();
      await workspaceStates.pull("generatingPromise");

      await execute();
    });
    const unsubscribe2 = workspaceStates.subscribe("commandRunAndWatchReloading", (e) => {
      if (e.value !== true) return;
      unsubscribe1();
      unsubscribe2();
    });

    await execute();
  };

  context.subscriptions.push(disposable);
};
