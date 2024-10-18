import * as vscode from "vscode";
import { states } from "../states";

export const bootstrap = async () => {
  const terminal = vscode.window.createTerminal({
    name: "milkio",
    cwd: states.value.cwd,
    iconPath: new vscode.ThemeIcon("debug-breakpoint-unverified"),
    isTransient: true,
  });
  terminal.sendText(states.value.cookbookToml.general.start);
  terminal.show();
};
