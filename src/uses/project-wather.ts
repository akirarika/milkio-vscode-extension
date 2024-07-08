import * as vscode from "vscode";
import { getWorkspace } from "../utils/get-workspace";
import { states } from "../states";
import { checkMilkioProject } from "../utils/check-milkio-project";

export const useProjectWatcher = async (context: vscode.ExtensionContext) => {
  const checkProject = async (workspace: vscode.WorkspaceFolder | null | undefined) => {
    if (!workspace) {
      states.publish("activeProject", null);
      await vscode.commands.executeCommand(`setContext`, `isMilkioProject`, false);
      return;
    }

    await vscode.commands.executeCommand(`setContext`, `isMilkioProject`, true);
    states.publish("activeProject", workspace);
  };

  if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders?.length === 0) {
    states.publish("mode", "single");
    return;
  }

  // If there is only one workspace, there is no need to judge based on the way files are opened
  if (vscode.workspace.workspaceFolders.length === 1) {
    states.publish("mode", "single");
    if (!(await checkMilkioProject(vscode.workspace.workspaceFolders[0].uri.fsPath))) await checkProject(undefined);
    else await checkProject(vscode.workspace.workspaceFolders[0]);
    return;
  }

  if (vscode.workspace.workspaceFolders.length > 1) {
    let counter = 0;
    let checkdWorkspace: vscode.WorkspaceFolder | undefined = undefined;
    for (const workspace of vscode.workspace.workspaceFolders) {
      if (await checkMilkioProject(workspace.uri.fsPath)) {
        counter++;
        checkdWorkspace = workspace;
      }
    }
    if (counter === 1) {
      states.publish("mode", "single");
      await checkProject(checkdWorkspace!);
      return;
    }
  }

  // Monitor the active file to determine the selected workspace based on the file.
  const handler = async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      states.publish("activeProject", null);
      return;
    }
    const workspaces = getWorkspace(editor.document.uri.fsPath);
    let workspaceReal: vscode.WorkspaceFolder | undefined = undefined;
    for (const workspace of workspaces) {
      if (!workspace || !(await checkMilkioProject(workspace.uri.fsPath))) continue;
      if (workspaceReal === undefined) {
        workspaceReal = workspace;
        continue;
      } else {
        if (workspace.uri.fsPath.length > workspaceReal.uri.fsPath.length) workspaceReal = workspace;
        continue;
      }
    }
    await checkProject(workspaceReal);
  };

  states.publish("mode", "multiple");
  vscode.window.onDidChangeActiveTextEditor(handler);
  await handler();
};
