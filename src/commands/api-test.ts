import * as vscode from "vscode";
import { getWorkspaceStates, states } from "../states";
import { waitingGenerated } from "../utils/waiting-generated";
import { checkMilkioProject } from "../utils/check-milkio-project";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getEnv } from "../utils/get-env";

const output = states.pull("output") as vscode.OutputChannel;

export const registerApiTest = (context: vscode.ExtensionContext) => {
  const disposable = vscode.commands.registerCommand("milkio.run-api-test", async () => {
    const workspace = states.pull("activeProject") as vscode.WorkspaceFolder;
    const workspaceStates = getWorkspaceStates(workspace);
    if (!workspace || !workspaceStates) return;
    const milkioWatcher = vscode.window.terminals.find((terminal) => terminal.name === (states.pull("mode") === "multiple" ? `(${workspace.name}) Milkio Run & Watch` : `Milkio Run & Watch`))
    if (!milkioWatcher) { await vscode.commands.executeCommand("milkio.run-and-watch"); }
    await new Promise((resolve) => setTimeout(resolve, 500));
    await workspaceStates.pull("generatingPromise");
    const docment = vscode.window.activeTextEditor?.document;
    if (!docment) return;
    if (!(await checkMilkioProject(workspace.uri.fsPath))) return;

    const filePath = docment.uri.fsPath.slice(workspace.uri.fsPath.length + "/src/app/".length).slice(0, -3);
    const terminalName =
      states.pull("mode") === "multiple"
        ? `(${workspace.name}) Milkio API Test`
        : `Milkio API Test`;

    vscode.window.terminals.find((terminal) => terminal.name.endsWith(`Milkio API Test`))?.dispose();
    vscode.window.terminals.find((terminal) => terminal.name.endsWith(`Milkio All API Test`))?.dispose();

    // If there is no terminal launched at startup, launch one. This is not necessary for Milkio but to optimize user experience. Otherwise, when Milkio exits, the entire panel will also exit.
    if (vscode.window.terminals.length === 0) vscode.window.createTerminal({ cwd: workspace.uri.fsPath, env: { ...getEnv() } }).show();

    const terminal = vscode.window.createTerminal({
      name: terminalName,
      cwd: workspace.uri.fsPath,
      iconPath: new vscode.ThemeIcon("beaker"),
      isTransient: true,
      env: {
        ...getEnv(),
        MILKIO_API_TEST_PATH: filePath,
      },
    });

    let packageJson = await JSON.parse((await readFile(join(workspace.uri.fsPath, "package.json"))).toString());
    let command = packageJson?.scripts?.["api-test"];
    terminal.sendText(`bun ./node_modules/milkio/c.ts EAR "${Buffer.from(command, 'utf-8').toString('base64')}"`);
    setTimeout(() => terminal.show(), 500);
  });

  context.subscriptions.push(disposable);
};
