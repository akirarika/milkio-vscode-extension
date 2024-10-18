import * as vscode from "vscode";
import { debounce } from "lodash";
import { nextTick } from "node:process";

export const useStepTree = (context: vscode.ExtensionContext) => {
  vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (!editor) return;
    schemaProvider.refresh();
  });

  const onRefresh = debounce(() => {
    schemaProvider.refresh();
  }, 640);

  vscode.workspace.onDidChangeTextDocument(
    (event: vscode.TextDocumentChangeEvent) => {
      onRefresh();
    }
  );

  const schemaProvider = new SchemaProvider();
  vscode.window.registerTreeDataProvider("milkio.steps", schemaProvider);

  const disposable = vscode.commands.registerCommand(
    "milkio.steps-to",
    async (document: vscode.TextDocument, line: number) => {
      vscode.window.showTextDocument(document);
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
      await nextTick(() => {
        editor.revealRange(editor.document.lineAt(line).range, 3);
        editor.selection = new vscode.Selection(
          editor.document.lineAt(line).range.end,
          editor.document.lineAt(line).range.end
        );
      });
    }
  );

  context.subscriptions.push(disposable);
};

const onStepTreeDocment = async (
  element?: SchemaItem
): Promise<Array<SchemaItem>> => {
  const items: Array<SchemaItem> = [];
  const editor = vscode.window.activeTextEditor;
  let document: vscode.TextDocument;
  if (
    !editor ||
    (editor.document.languageId !== "typescript" &&
      editor.document.languageId !== "tsx" &&
      editor.document.languageId !== "vue")
  )
    return [];
  document = editor.document;
  const content = document.getText().split("\n");
  const fileTitle = document.fileName.split("/").at(-1);

  if (!element) {
    // is namespaces
    let currentline = -1; // NOTE: that it does not increment from 0, but from 1!
    const maxline = document.lineCount;
    let metaSelected = false;
    let actionSelected = false;
    let testsSelected = false;
    let vueTemplateSelected = false;
    let vueScriptSelected = false;
    let vueStyleSelected = false;

    while (currentline < maxline - 1) {
      currentline = currentline + 1;
      const text = content[currentline];
      let title: string = "";
      if (text.includes("meta:")) {
        if (metaSelected) continue;
        title = "Meta";
        metaSelected = true;
      } else if (text.includes("action(")) {
        if (actionSelected) continue;
        title = "Action";
        actionSelected = true;
      } else if (text.includes("defineApiTest(")) {
        if (testsSelected) continue;
        title = "Tests";
        testsSelected = true;
      } else if (
        document.languageId === "vue" &&
        text.startsWith("<template")
      ) {
        if (vueTemplateSelected) continue;
        title = "Template";
        vueTemplateSelected = true;
      } else if (document.languageId === "vue" && text.startsWith("<script")) {
        if (vueScriptSelected) continue;
        title = "Script";
        vueScriptSelected = true;
      } else if (document.languageId === "vue" && text.startsWith("<style")) {
        if (vueStyleSelected) continue;
        title = "Style";
        vueStyleSelected = true;
      } else {
        continue;
      }

      if (items.at(-1)) items.at(-1)!.stopline = currentline - 1;

      items.push(
        new SchemaItem({
          title: title,
          document: document,
          model: false,
          startline: currentline,
          stopline: maxline - 1,
          command: {
            command: "milkio.steps-to",
            title: "title",
            arguments: [document, currentline],
          },
          collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
        })
      );
    }

    if (items.length === 0) {
      items.push(
        new SchemaItem({
          title: editor.document.languageId,
          document: document,
          model: false,
          startline: 0,
          stopline: maxline - 1,
          command: {
            command: "milkio.steps-to",
            title: "title",
            arguments: [document, 0],
          },
          collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
        })
      );
    }
  } else {
    // is code item
    let currentline = element.startline - 1;
    const maxline = element.stopline;

    while (currentline < maxline) {
      let startline = -1;
      currentline = currentline + 1;
      const text = content[currentline];
      const lang = document.languageId;
      let title: string = "";

      if (text.includes(".step(")) {
        let tmpLine = currentline - 1;
        if (content[tmpLine].trim().startsWith("*/")) {
          while (true) {
            tmpLine = tmpLine - 1;
            if (content[tmpLine].trim().startsWith("*")) {
              title = `step: ${content[tmpLine]
                .trim()
                .replace(/^\*+/, "")
                .trim()}`;
              startline = tmpLine;
            } else break;
          }
        } else {
          title = "step";
        }
      } else if (
        element.label === "Tests" &&
        (text.trim().startsWith("handler:") ||
          text.trim().startsWith("handler(") ||
          text.trim().startsWith("async handler("))
      ) {
        let tmpLine = currentline - 1;
        if (!content[tmpLine].trim().startsWith("name:")) {
          continue;
        }
        title = `test: `;
        const strArr = content[tmpLine].trim().match(/(['"`]).*?\1/g);
        if (strArr) {
          for (const str of strArr) {
            title = title + str.substring(1, str.length - 1);
          }
        }
      } else {
        continue;
      }

      items.push(
        new SchemaItem({
          title: title,
          document: document,
          model: true,
          startline: startline === -1 ? currentline : startline,
          stopline: currentline,
          command: {
            command: "milkio.steps-to",
            title: "title",
            arguments: [document, startline === -1 ? currentline : startline],
          },
          collapsibleState: vscode.TreeItemCollapsibleState.None,
        })
      );
    }
  }

  return items;
};

export class SchemaProvider implements vscode.TreeDataProvider<SchemaItem> {
  constructor() {}

  getTreeItem(element: SchemaItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: SchemaItem): Thenable<SchemaItem[]> {
    return onStepTreeDocment(element);
  }

  private _onDidChangeTreeData: vscode.EventEmitter<
    SchemaItem | undefined | null | void
  > = new vscode.EventEmitter<SchemaItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    SchemaItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }
}

class SchemaItem extends vscode.TreeItem {
  constructor(options: {
    collapsibleState: vscode.TreeItemCollapsibleState;
    title: string;
    model: boolean;
    startline: number;
    stopline: number;
    command: any;
    document: vscode.TextDocument;
    iconPath?: any;
    tooltip?: string | vscode.MarkdownString | undefined;
  }) {
    super(options.title, options.collapsibleState);
    this.command = options.command;
    this.model = options.model;
    this.startline = options.startline;
    this.stopline = options.stopline;
    this.iconPath = options?.iconPath || undefined;
    this.tooltip = options?.tooltip || undefined;
  }

  model: boolean;
  startline: number;
  stopline: number;
}
