# `octo-sts/action`

This action federates the GitHub Actions identity token for a Github App token
according to the Trust Policy in the target organization or repository.

## Usage

```yaml
permissions:
  id-token: write # Needed to federate tokens.

steps:
- uses: octo-sts/action@main
  id: octo-sts
  with:
    scope: your-org/your-repo
    identity: foo

- env:
    GITHUB_TOKEN: ${{ steps.octo-sts.outputs.token }}
  run: |
    gh repo list
```

The above will load a "trust policy" from `.github/chainguard/foo.sts.yaml` in
the repository `your-org/your-repo`.  Suppose this contains the following, then
workflows in `my-org/my-repo` will receive a token with the specified
permissions on `my-org/my-repo`.

```yaml
issuer: https://token.actions.githubusercontent.com
subject: repo:my-org/my-repo:ref:refs/heads/main

permissions:
  contents: read
  issues: write
```

See the [Use Action](./.github/workflows/use-action.yaml) workflow for a working example of this, that opens an issue in this repository.

## GitHub Enterprise Server

When the job finishes, the action revokes the token it minted. The API used for
that is taken from the `github.api_url` context, so on GitHub Enterprise Server
the token is revoked against that instance rather than against
`api.github.com`. No configuration is needed for this — on GHES the defaults are
already correct.

Note that on GHES the trust policy must name the enterprise's own OIDC issuer,
which is not `https://token.actions.githubusercontent.com`:

```yaml
issuer: https://ghes.example.com/_services/token
subject: repo:my-org/my-repo:ref:refs/heads/main

permissions:
  contents: read
```

You can confirm the exact value for your instance at
`https://ghes.example.com/_services/token/.well-known/openid-configuration`.

## Inputs

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `scope` | yes | | The `org/repo` to which access is requested. |
| `identity` | yes | | Trust policy to load from `.github/chainguard/{identity}.sts.yaml` in the scope repository. |
| `domain` | no | `octo-sts.dev` | Domain of the Octo STS instance used to federate. |
| `scheme` | no | `https` | URL scheme used to reach the Octo STS instance. Use `http` only on a trusted network. |
| `github-api-url` | no | `${{ github.api_url }}` | Base URL of the GitHub API used to revoke the token at the end of the job. Override only to target a different API endpoint. |

