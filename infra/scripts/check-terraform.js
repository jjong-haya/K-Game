const { existsSync } = require("node:fs");
const { delimiter, join } = require("node:path");
const { spawnSync } = require("node:child_process");

function commandFromPath() {
  const command = process.platform === "win32" ? "where.exe" : "which";
  const result = spawnSync(command, ["terraform"], { encoding: "utf8" });

  if (result.status !== 0) {
    return null;
  }

  const firstLine = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  return firstLine || null;
}

function wingetTerraformPath() {
  if (process.platform !== "win32") {
    return null;
  }

  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) {
    return null;
  }

  const candidate = join(
    localAppData,
    "Microsoft",
    "WinGet",
    "Packages",
    "Hashicorp.Terraform_Microsoft.Winget.Source_8wekyb3d8bbwe",
    "terraform.exe"
  );

  return existsSync(candidate) ? candidate : null;
}

function resolveTerraformBinary() {
  return commandFromPath() || wingetTerraformPath() || "terraform";
}

function runTerraform(terraformBin, args) {
  const result = spawnSync(terraformBin, args, {
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    console.error("[check:infra] Terraform 실행에 실패했습니다.");
    console.error(
      "[check:infra] PATH를 새로 열거나 Terraform 설치를 확인해 주세요."
    );
    console.error(`[check:infra] 시도한 실행 파일: ${terraformBin}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

const terraformBin = resolveTerraformBinary();
const infraDir = "./infra/terraform";

console.log(`[check:infra] Terraform binary: ${terraformBin}`);
runTerraform(terraformBin, ["-chdir=" + infraDir, "init", "-backend=false"]);
runTerraform(terraformBin, ["-chdir=" + infraDir, "validate"]);
