const VERSION_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)$/;

export function resolveCurrentVersion(tags, manifestVersion) {
  const versions = [manifestVersion, ...tags]
    .map((value) => {
      const match = String(value).trim().match(VERSION_PATTERN);
      return match ? match.slice(1).map(Number) : null;
    })
    .filter(Boolean);

  if (versions.length === 0) throw new Error('No valid semantic version found in git tags or package.json.');
  versions.sort((left, right) => compareVersionParts(right, left));
  return versions[0].join('.');
}

export function getNextVersions(current) {
  const match = String(current).match(VERSION_PATTERN);
  if (!match) throw new Error(`Invalid semantic version: ${current}`);
  const [major, minor, patch] = match.slice(1).map(Number);
  return {
    current: `${major}.${minor}.${patch}`,
    nextPatch: `${major}.${minor}.${patch + 1}`,
    nextMinor: `${major}.${minor + 1}.0`,
    nextMajor: `${major + 1}.0.0`,
  };
}

export function getReleaseContextIssues({ branch, workingTreeDirty }) {
  const issues = [];
  if (branch !== 'main') issues.push('Releases must run on main after the feature pull request has been merged.');
  if (workingTreeDirty) issues.push('The working tree must be clean before releasing.');
  return issues;
}

function compareVersionParts(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}
