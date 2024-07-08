import * as vscode from "vscode";
import { definePurinPubsub } from "./utils/purin-pubsub";

export const runtime = {
  // If it is the first time, do not execute quick generation.
  notFirstGen: false,
};

export const states = definePurinPubsub<{
  output: vscode.OutputChannel;
  statusBar: vscode.StatusBarItem;
  activeProject: null | vscode.WorkspaceFolder;
  // The user may not have set the environment variable, but actually installed bun (in the default~/. bun/bin/bun). If this value is true, it indicates that the user is in this situation. In this case, when calling bun, an absolute path is used
  absoluteBun: boolean;
  // The number of projects in the current workspace that belong to Milkio. If there are multiple, also display the name of the workspace where Milkio is located.
  mode: 'single' | 'multiple'
}>();

states.publish("output", vscode.window.createOutputChannel("Milkio"));
states.publish("statusBar", vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100));
states.publish("activeProject", null);
states.publish("absoluteBun", false);

export const workspaceStatesMap = new Map<string, ReturnType<typeof makeWorkspaceState>>();

export const makeWorkspaceState = () => {
  const workspaceStates = definePurinPubsub<{
    installing: boolean;
    generating: boolean;
    generatingPromise: null | Promise<unknown>;
    cookbookBuilding: boolean;
    cookbookBuildingPromise: null | Promise<unknown>;
    commandRunAndWatchReloading: boolean;
    commandRunAndWatchTerminalName: null | string;
  }>();
  workspaceStates.publish("generating", false);
  workspaceStates.publish("generatingPromise", null);
  workspaceStates.publish("cookbookBuilding", false);
  workspaceStates.publish("cookbookBuildingPromise", null);
  workspaceStates.publish("commandRunAndWatchReloading", false);
  workspaceStates.publish("commandRunAndWatchTerminalName", null);

  return workspaceStates;
};

export const getWorkspaceStates = (workspace?: vscode.WorkspaceFolder | null) => {
  if (!workspace) return undefined;
  if (workspaceStatesMap.has(workspace.uri.fsPath)) {
    return workspaceStatesMap.get(workspace.uri.fsPath);
  } else {
    const state = makeWorkspaceState();
    workspaceStatesMap.set(workspace.uri.fsPath, state);
    return state;
  }
};
