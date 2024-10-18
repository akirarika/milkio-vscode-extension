import * as vscode from "vscode";
import { existsSync } from "fs";
import { join } from "path";
import { readFile } from "fs/promises";
import { load } from "js-toml";
import { CookbookOptions } from "./utils/cookbook-dto-types";
import { states } from "./states";
import { markRaw } from "@vue/reactivity";
import { bootstrap } from "./bootstrap";
import { createFromTemplateCommand } from "./command/create-from-template.command";
import { useStepTree } from "./step/step-tree";

export async function activate(context: vscode.ExtensionContext) {
  if (vscode.workspace.workspaceFolders?.length !== 1) return;
  const workspace = vscode.workspace.workspaceFolders[0];
  if (!existsSync(join(workspace.uri.fsPath, "cookbook.toml"))) return;

  const cookbookTomlRaw = (
    await readFile(join(workspace.uri.fsPath, "cookbook.toml"))
  ).toString();
  const cookbookToml = load(cookbookTomlRaw) as CookbookOptions;
  if (!cookbookToml.general.start) {
    vscode.window.showInformationMessage("Cookbook: Start script detected.");
    return;
  }

  states.value.cwd = workspace.uri.fsPath;
  states.value.cookbookToml = markRaw(cookbookToml);
  states.value.extensionEnable = true;

  await bootstrap();

  await Promise.all([
    //
    createFromTemplateCommand(context),
    useStepTree(context),
  ]);
}

export function deactivate() {}
