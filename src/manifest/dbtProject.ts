import { readFileSync } from "fs";
import { safeLoad } from "js-yaml";
import * as path from "path";
import { SourceFileWatchers } from "./handlers/sourceFileWatchers";
import { TargetWatchers } from "./handlers/targetWatchers";
import { DBTProjectLog } from "./handlers/dbtProjectLog";
import { setupWatcherHandler } from "../utils";
import { Disposable, FileSystemWatcher, RelativePattern, Uri, workspace } from "vscode";
import { OnProjectConfigChanged, ProjectConfigChangedEvent } from "./event/projectConfigChangedEvent";

export class DBTProject implements Disposable {
  static DBT_PROJECT_FILE = "dbt_project.yml";
  static DBT_MODULES = "dbt_modules";
  static MANIFEST_FILE = "manifest.json";
  static RUN_RESULTS_FILE = "run_results.json";
  static TARGET_PATH_VAR = "target-path";
  static SOURCE_PATHS_VAR = "source-paths";

  readonly projectRoot: Uri;
  private dbtProjectWatcher?: FileSystemWatcher;
  private dbtProjectLog = new DBTProjectLog();
  private onProjectConfigChangedHandlers: OnProjectConfigChanged[] = [new TargetWatchers(), new SourceFileWatchers(), this.dbtProjectLog];

  constructor(path: Uri) {
    this.projectRoot = path;
    this.dbtProjectWatcher = workspace.createFileSystemWatcher(
      new RelativePattern(
        path,
        DBTProject.DBT_PROJECT_FILE
      )
    );
    setupWatcherHandler(this.dbtProjectWatcher, () => this.tryRefresh());
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

  findPackageName(uri: Uri): string | undefined {
    const documentPath = uri.path;
    const pathSegments = documentPath.replace(this.projectRoot.path, "").split("/");

    const insidePackage =
      pathSegments.length > 1 && pathSegments[0] === DBTProject.DBT_MODULES;

    if (insidePackage) {
      return pathSegments[1];
    }
    return undefined;
  }

  contains(uri: Uri) {
    return uri.path.startsWith(this.projectRoot.path);
  }
  
  dispose() {
    this.dbtProjectLog.dispose();
  }

  private readAndParseProjectConfig() {
    const dbtProjectYamlFile = readFileSync(
      path.join(this.projectRoot.fsPath, DBTProject.DBT_PROJECT_FILE),
      "utf8"
    );
    return safeLoad(dbtProjectYamlFile) as any;
  }

  private async refresh() {
    const projectConfig = this.readAndParseProjectConfig();

    const event = new ProjectConfigChangedEvent(this.projectRoot, projectConfig);
    this.onProjectConfigChangedHandlers.forEach(handler => handler.onProjectConfigChanged(event));
  }
}
