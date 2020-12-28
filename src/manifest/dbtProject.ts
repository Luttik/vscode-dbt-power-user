import * as vscode from "vscode";
import { readFileSync } from "fs";
import { safeLoad } from "js-yaml";
import * as path from "path";
import { ProjectConfigWatcherFactory } from "./watchers/projectConfigWatcherFactory";
import { SourceFileWatchers } from "./watchers/sourceFileWatchers";
import { TargetWatchers } from "./watchers/targetWatchers";
import { DBTProjectLog } from "./dbtProjectLog";
import { OnProjectConfigChanged, ProjectConfigChangedEvent } from "./projectConfigChangedEvent";

export class DBTProject {
  static DBT_PROJECT_FILE = "dbt_project.yml";
  static DBT_MODULES = "dbt_modules";
  static MANIFEST_FILE = "manifest.json";
  static RUN_RESULTS_FILE = "run_results.json";
  static TARGET_PATH_VAR = "target-path";
  static SOURCE_PATHS_VAR = "source-paths";

  private dbtProjectWatcher?: vscode.FileSystemWatcher;
  private projectRoot: vscode.Uri;
  private onProjectConfigChangedHandlers: OnProjectConfigChanged[] = [new TargetWatchers(), new SourceFileWatchers(), new DBTProjectLog()];

  constructor(path: vscode.Uri) {
    this.projectRoot = path;
  }

  async tryRefresh() {
    try {
      await this.refresh();
    } catch (error) {
      console.log(
        "We should never come here, means that our exceptions are not handled!",
        error
      );
    }
  }

  private readAndParseProjectConfig() {
    const dbtProjectYamlFile = readFileSync(
      path.join(this.projectRoot.fsPath, DBTProject.DBT_PROJECT_FILE),
      "utf8"
    );
    return safeLoad(dbtProjectYamlFile) as any;
  }

  private async refresh() {
    if (this.dbtProjectWatcher === undefined) {
      this.dbtProjectWatcher = ProjectConfigWatcherFactory.createProjectConfigWatcher(this.projectRoot, () => this.tryRefresh());
    }
    const projectConfig = this.readAndParseProjectConfig();

    const event = new ProjectConfigChangedEvent(this.projectRoot, projectConfig);
    this.onProjectConfigChangedHandlers.forEach(handler => handler.onProjectConfigChanged(event));
  }
}
