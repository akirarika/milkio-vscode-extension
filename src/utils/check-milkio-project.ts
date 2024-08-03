import { existsSync } from "fs";
import { join } from "path";
import * as vscode from "vscode";
import { exec } from "node:child_process";
import { states } from "../states";
import { getEnv } from "./get-env";
import { getBun } from "./get-bun";
import { platform } from "node:process";

export const checkMilkioProject = async (fspath: string): Promise<boolean> => {
  if (!(existsSync(join(fspath, "package.json")))) return false;
  let packageJson: string;
  try {
    packageJson = (await vscode.workspace.fs.readFile(vscode.Uri.file(join(fspath, "package.json")))).toString();
  } catch (error) {
    return false;
  }

  if (!packageJson.includes(`"milkio":`)) return false;

  const output = states.pull("output") as vscode.OutputChannel;

  if (!(existsSync(join(fspath, "milkio.toml")))) {
    return false;
  }

  // if (!(existsSync(join(fspath, "node_modules")))) {
  //   let installSuccess = false;
  //   const bunInstalling = new Promise((resolve) => {
  //     const command = `${getBun()} install`;
  //     exec(
  //       command,
  //       {
  //         cwd: fspath,
  //         env: { ...getEnv() },
  //       },
  //       (error, stdout) => {
  //         output.append(stdout);
  //         if (error) {
  //           output.append(error.message);
  //           if (error.stack) output.append(error.stack);
  //           output.append(`\nDependencies installation failed. The work of the Milkio extension requires a successful installation of dependencies first. Try manually installing the dependencies (e.g. running \`bun i\`) and then re-running VSCode to get the Milkio extension to start.`);
  //           output.show();
  //           vscode.window.showErrorMessage(`Dependencies installation failed. Restart the editor after successful installation to enable the Milkio extension.`);
  //         } else {
  //           installSuccess = true;
  //         }
  //         resolve(undefined);
  //       }
  //     );
  //   });

  //   await vscode.window.withProgress(
  //     {
  //       title: "Dependencies installing..",
  //       cancellable: false,
  //       location: vscode.ProgressLocation.Notification,
  //     },
  //     (progress, token) => {
  //       return new Promise(async (resolve) => {
  //         await bunInstalling;
  //         resolve(undefined);
  //       });
  //     }
  //   );

  //   if (!installSuccess) return false;
  // }

  // check if dependencies installed
  if (!(existsSync(join(fspath, "node_modules", "milkio", "c.ts")))) {
    vscode.window
      .showInformationMessage('Dependency is not installed, do you want to install it? Milkio can only work properly after successful installation.', 'install')
      .then(selection => {
        if (!selection) return;

        const terminal = vscode.window.createTerminal({
          cwd: fspath,
          iconPath: new vscode.ThemeIcon("beaker"),
          isTransient: true,
          env: {
            ...getEnv(),
          },
        });
        terminal.show();
        if (platform === "win32") {
          terminal.sendText(`$ErrorActionPreference = "Stop"; ${getBun()} install; ${getBun()} run milkio gen`);
        } else {
          terminal.sendText(`${getBun()} install && ${getBun()} run milkio gen`);
        }

        setTimeout(() => {
          vscode.window
            .showWarningMessage('After installed, you can make the Milkio extension effective by restarting VS Code.', 'Restart VS Code')
            .then(selection => {
              if (!selection) return;
              vscode.commands.executeCommand("workbench.action.reloadWindow");
            });
        }, 3000);
      });

    return false;
  }

  // check if generated
  if (!(existsSync(join(fspath, "generated", "api-schema.ts")))) {
    await new Promise((resolve) => {
      const command = `${getBun()} run milkio gen`;
      exec(
        command,
        {
          cwd: fspath,
          env: { ...getEnv() },
        },
        (error, stdout) => {
          output.append(stdout);
          if (error) {
            output.append(error.message);
            if (error.stack) output.append(error.stack);
            // output.show();
          }
          resolve(undefined);
        }
      );
    })
  }

  return true;
};
