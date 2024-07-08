import { load } from 'js-toml';
import * as vscode from "vscode";
import { getWorkspaceStates, states, workspaceStatesMap } from "../states";
import { generate } from "../uses/auto-generate";
import { cwd, env } from 'node:process';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { checkMilkioProject } from '../utils/check-milkio-project';
import { getEnv } from '../utils/get-env';

export const registerExtensionMenu = (context: vscode.ExtensionContext) => {
  const output = states.pull("output") as vscode.OutputChannel;
  const disposable = vscode.commands.registerCommand("milkio.open-extension-menu", async () => {
    const workspace = states.pull("activeProject") as vscode.WorkspaceFolder;
    const workspaceStates = getWorkspaceStates(workspace);
    if (!workspace || !workspaceStates) return;
    if (!await checkMilkioProject(workspace.uri.fsPath)) return;

    const items: Array<vscode.QuickPickItem & { command: string, builtIn: boolean, icon: string, env: Record<string, string> }> = [];
    items.push({ label: "Run Milkio & Watch", description: "(built-in)", builtIn: true, command: '', icon: "plug", env: {} });

    if (existsSync(join(workspace.uri.fsPath, "milkio.toml"))) {
      const milkioConfig = load(await readFile(join(workspace.uri.fsPath, "milkio.toml"), "utf-8")) as MilkioConfig;
      if (milkioConfig?.menubar?.commands) {
        for (const command of milkioConfig.menubar.commands) {
          items.push({ label: command.name ?? 'no name', command: command.script || 'echo "no script"', builtIn: false, icon: command.icon ?? 'plug', env: command.env ?? {} });
        }
      }
    }

    items.push({ label: "Generate", description: "(built-in)", builtIn: true, command: '', icon: "plug", env: {} });
    items.push({ label: "Open Milkio Documents (via Browser)", builtIn: true, description: "(built-in)", command: '', icon: "plug", env: {} });

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: (process.platform !== "darwin" ? "(ALT + L)" : "(⌘ + ⇧ + L)") + ` can open milkio menubar`,
    });

    if (!selected) return;
    if (selected.builtIn) {
      if (selected.label === "Run Milkio & Watch") {
        vscode.commands.executeCommand("milkio.run-and-watch");
      } else if (selected.label === "Generate") {
        if (vscode.window.terminals.find((terminal) => terminal.name === (states.pull("mode") === "multiple" ? `(${workspace.name}) Milkio Run & Watch` : `Milkio Run & Watch`))) {
          vscode.window.showErrorMessage(
            "Milkio Run & Watch is in the open, generate will cause it to throw an exception. Please close and try again."
          );
        } else {
          await vscode.commands.executeCommand("milkio.generate");
        }
      } else if (selected.label === "$(database) Database Generate & Migrate") {
        await vscode.commands.executeCommand("milkio.generate-database");
      }
    } else {
      const terminalName =
        states.pull("mode") === "multiple"
          ? `(${workspace.name}) ${selected.label}`
          : `${selected.label}`;

      const generatePromise = generate(workspace.uri, true);
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

      vscode.window.terminals.find((terminal) => terminal.name.endsWith(`${selected.label}`))?.dispose();
      vscode.window.terminals.find((terminal) => terminal.name.endsWith(`${selected.label}`))?.dispose();
      // If there is no terminal launched at startup, launch one. This is not necessary for Milkio but to optimize user experience. Otherwise, when Milkio exits, the entire panel will also exit.
      if (vscode.window.terminals.length === 0) vscode.window.createTerminal({ cwd: workspace.uri.fsPath, env: { ...getEnv() } }).show();

      const terminal = vscode.window.createTerminal({
        name: terminalName,
        cwd: workspace.uri.fsPath,
        iconPath: new vscode.ThemeIcon("beaker"),
        isTransient: true,
        env: {
          ...getEnv(),
          ...selected.env,
        },
      });
      terminal.show();

      let command = selected.command;
      terminal.sendText(`bun ./node_modules/milkio/c.ts EAR "${Buffer.from(command, 'utf-8').toString('base64')}"`);
    }
  });

  context.subscriptions.push(disposable);
};

export type MilkioConfig = {
  generate?: {
    significant?: Array<string>;
    insignificant?: Array<string>;
  },
  link?: {
    projects?: Array<{ name?: string, cwd?: string, script?: Record<string, string> }>;
  }
  menubar?: {
    commands?: Array<{ name?: string, script?: string, icon?: string, env?: Record<string, string> }>;
  }
};