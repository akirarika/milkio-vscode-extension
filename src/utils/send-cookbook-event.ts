import * as vscode from "vscode";
import { states } from "../states";
import type { CookbookActionParams } from "./cookbook-dto-types";

export const sendCookbookEvent = async (event: CookbookActionParams) => {
  try {
    const { TSON } = await import("@southern-aurora/tson");
    const response = await fetch(
      `http://localhost:${states.value.cookbookToml.general.cookbookPort}/$action`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: TSON.stringify(event),
      }
    );
    if (!response.ok) {
      console.log("[COOKBOOK]", await response.text());
      vscode.window.showInformationMessage(await response.text());
    }
  } catch (error) {
    console.log("[COOKBOOK]", error);
    vscode.window.showInformationMessage(
      `Is Cookbook closed? There is an abnormality in the communication with Cookbook.`
    );
  }
};
