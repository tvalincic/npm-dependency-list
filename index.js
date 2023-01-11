const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const readFile = promisify(fs.readFile);
const exec = promisify(require("child_process").exec);

const nodeModules = path.join("node_modules");

async function getDependencies(packageJson) {
  const content = await readFile(packageJson);
  const { dependencies, devDependencies } = JSON.parse(content);
  const allDependencies = { ...dependencies, ...devDependencies };
  const allDependenciesNames = Object.keys(allDependencies);
  const minus5Dependencies = allDependenciesNames.filter((dependency) =>
    dependency.startsWith("@minus5")
  );
  const otherDependencies = allDependenciesNames.filter(
    (dependency) => !dependency.startsWith("@minus5")
  );
  return {
    minus5Dependencies,
    otherDependencies,
    allDependencies,
  };
}

async function readPackageJson(dependency, libPath) {
  // check if node_modules exists, if not run npm install
  if (!fs.existsSync(path.join(libPath, nodeModules))) {
    await exec("npm install", { cwd: libPath });
  }

  const packageJsonPath = path.join(
    libPath,
    nodeModules,
    dependency,
    "package.json"
  );
  const packageJsonContent = await readFile(packageJsonPath);
  return JSON.parse(packageJsonContent);
}

async function getDependenciesDescriptions(dependencies, lib) {
  const descriptions = {};
  for (const dependency of dependencies) {
    const packageJson = await readPackageJson(dependency, lib);
    descriptions[dependency] = packageJson.description;
  }
  return descriptions;
}

async function getDependenciesVersions(dependencies, lib) {
  const versions = {};
  for (const dependency of dependencies) {
    const packageJson = await readPackageJson(dependency, lib);
    versions[dependency] = packageJson.version;
  }
  return versions;
}

async function getDependenciesNames(dependencies, lib) {
  const names = {};
  for (const dependency of dependencies) {
    const packageJson = await readPackageJson(dependency, lib);
    names[dependency] = packageJson.name;
  }
  return names;
}

async function generateHtml(...packages) {
  let descriptions = {};
  let versions = {};
  let names = {};
  let dependencies = [];
  // await until all dependencies are resolved
  for (const package of packages) {
    console.log("start", package);
    let { otherDependencies } = await getDependencies(
      package + "/package.json"
    );
    otherDependencies = otherDependencies.filter(
      (dependency) => !dependencies.includes(dependency)
    );
    if (!otherDependencies.length) continue;
    dependencies = [...dependencies, ...otherDependencies];
    descriptions = {
      ...descriptions,
      ...(await getDependenciesDescriptions(otherDependencies, package)),
    };
    versions = {
      ...versions,
      ...(await getDependenciesVersions(otherDependencies, package)),
    };
    names = {
      ...names,
      ...(await getDependenciesNames(otherDependencies, package)),
    };
    console.log("done", package);
  }
  console.log(dependencies.length);
  const html = `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8">
      <title>Dependencies</title>
    </head>
    <body>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Version</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          ${dependencies
            .map(
              (dependency) => `
            <tr>
              <td>${names[dependency]}</td>
              <td>${versions[dependency]}</td>
              <td>${descriptions[dependency]}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </body>
  </html>`;
  return html;
}

async function main() {
  // Provide paths to all apps that you want to check
  // Provided directory should contain package.json
  // for example, const apps = [__dirname, `${__dirname}/app`]
  const apps = [];
  const html = await generateHtml(apps);
  fs.writeFile("dependencies.html", html, (err) => {
    if (err) {
      console.log(err);
    }
  });
}

main();
