/** מפעיל את GitHub Action של ה-IFA. בלי GITHUB_DISPATCH_TOKEN זה no-op. */
export async function dispatchIfaWorkflow(): Promise<boolean> {
  const token = (process.env.GITHUB_DISPATCH_TOKEN ?? process.env.GH_PAT ?? "").trim();
  if (!token) return false;
  const owner = process.env.VERCEL_GIT_REPO_OWNER || "IdoAce12";
  const repo = process.env.VERCEL_GIT_REPO_SLUG || "Oranit-stats";
  const ref = process.env.VERCEL_GIT_COMMIT_REF || "main";
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/ifa-sync.yml/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({ ref }),
  });
  return res.status === 204;
}
