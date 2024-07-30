import * as vscode from "vscode";
import { useApiTest } from "./uses/api-test";
import { useAutoGenerate } from "./uses/auto-generate";
import { useStatusBar } from "./uses/status-bar";
import { useProjectWatcher } from "./uses/project-wather";
import { registerApiTest } from "./commands/api-test";
import { registerExtensionMenu } from "./commands/extension-menu";
import { registerOutputChannel } from "./commands/output-channel";
import { registerRunAndWatch } from "./commands/run-and-watch";
import { checkBunInstalled } from "./utils/check-bun-installed";
import { createFromTemplate } from "./commands/create-from-template";
import { useStepTree } from "./uses/step-tree";

export async function activate(context: vscode.ExtensionContext) {
  await useProjectWatcher(context);

  if ((await checkBunInstalled()) === false) return;

  // commands
  registerApiTest(context);
  registerExtensionMenu(context);
  registerOutputChannel(context);
  registerRunAndWatch(context);
  createFromTemplate(context);

  // uses
  await Promise.all([
    //
    useApiTest(context),
    useAutoGenerate(context),
    useStatusBar(context),
    useStepTree(context),
  ]);
}

export function deactivate() { }
