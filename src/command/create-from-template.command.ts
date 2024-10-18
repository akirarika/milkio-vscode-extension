import * as vscode from "vscode";
import { join } from "path";
import { existsSync } from "fs";
import { exec } from "child_process";
import { states } from "../states";
import { sendCookbookEvent } from "../utils/send-cookbook-event";

export const createFromTemplateCommand = (context: vscode.ExtensionContext) => {
  const disposable = vscode.commands.registerCommand(
    "milkio.create-from-template",
    async (uri: vscode.Uri) => {
      const items: Array<vscode.QuickPickItem> = [];

      const templates = [
        // read /node_modules/milkio/templates
        ...(await (async () => {
          const templatesPath = vscode.Uri.file(
            join(states.value.cwd, ".templates")
          );
          if (!existsSync(templatesPath.fsPath)) return [];
          return (
            await vscode.workspace.fs.readDirectory(templatesPath)
          ).filter(
            (item) =>
              item[0].endsWith(".template.ts") &&
              item[1] === vscode.FileType.File
          );
        })()),
      ];

      for (const template of templates) {
        items.push({ label: template[0].slice(0, -12) });
      }

      const instantiateName = await vscode.window.showInputBox({
        placeHolder: "What name should you give to the file(s) you created?",
      });
      if (!instantiateName) {
        return;
      }
      if (!/^[a-z0-9/$/-]+$/.test(instantiateName)) {
        vscode.window.showInformationMessage(
          `The path can only contain lowercase letters, numbers, and "-".`
        );
        return;
      }
      if (instantiateName === "src") {
        vscode.window.showInformationMessage(`Cannot use "src" as a name.`);
        return;
      }
      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: "Select a template",
      });
      if (!selected) return;

      await sendCookbookEvent({
        type: "milkio@template",
        name: instantiateName,
        template: selected.label,
        fsPath: uri.fsPath,
      });
    }
  );

  context.subscriptions.push(disposable);
};
