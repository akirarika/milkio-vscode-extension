import * as vscode from "vscode";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { load } from "js-toml";
import type { CookbookOptions } from "./utils/cookbook-dto-types";
import { states } from "./states";
import { markRaw } from "@vue/reactivity";
import { bootstrap } from "./bootstrap";
import { createFromTemplateCommand } from "./command/create-from-template.command";
import { useStepTree } from "./step/step-tree";

export async function activate(context: vscode.ExtensionContext) {
  useStepTree(context);

  if (vscode.workspace.workspaceFolders?.length !== 1) return;
  const workspace = vscode.workspace.workspaceFolders[0];
  if (!existsSync(join(workspace.uri.fsPath, "cookbook.toml"))) return;

  const cookbookTomlRaw = (await readFile(join(workspace.uri.fsPath, "cookbook.toml"))).toString();
  const cookbookToml = load(cookbookTomlRaw) as CookbookOptions;
  if (!cookbookToml.general.start) {
    vscode.window.showInformationMessage("Cookbook: Start script detected.");
    return;
  }

  states.value.cwd = workspace.uri.fsPath;
  states.value.cookbookToml = markRaw(cookbookToml);
  states.value.extensionEnable = true;

  void bootstrap();
  void Promise.all([
    //
    createFromTemplateCommand(context),
  ]);
}

export function deactivate() {}
