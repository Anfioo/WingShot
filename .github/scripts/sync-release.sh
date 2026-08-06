#!/usr/bin/env bash
set -euo pipefail

: "${PLATFORM:?PLATFORM is required (gitee or gitea)}"
: "${PLATFORM_TOKEN:?PLATFORM_TOKEN is required}"
: "${TAG_NAME:?TAG_NAME is required}"
: "${ASSETS_DIR:?ASSETS_DIR is required}"

if [[ ! -f release.json ]]; then
  echo "release.json is missing" >&2
  exit 1
fi

if [[ "$PLATFORM" == "gitea" ]]; then
  API_BASE="https://git.anfioo.com/api/v1"
  PLATFORM_REPO="anfioo/WingShot"
  AUTH=(-H "Authorization: token $PLATFORM_TOKEN")
  AUTH_QUERY=""
  ASSET_LIST_PATH="assets"
  DOWNLOAD_BASE="https://git.anfioo.com/anfioo/WingShot"
elif [[ "$PLATFORM" == "gitee" ]]; then
  API_BASE="https://gitee.com/api/v5"
  PLATFORM_REPO="anfioo/WingShot"
  AUTH=(-H "Authorization: token $PLATFORM_TOKEN")
  # Gitee accepts access_token as a query parameter; keep the header too for
  # installations that support the GitHub-compatible authorization header.
  encoded_token="$(jq -rn --arg value "$PLATFORM_TOKEN" '$value | @uri')"
  AUTH_QUERY="access_token=$encoded_token"
  ASSET_LIST_PATH="attach_files"
  DOWNLOAD_BASE="https://gitee.com/anfioo/WingShot"
else
  echo "Unsupported platform: $PLATFORM" >&2
  exit 1
fi

repo_path="repos/$PLATFORM_REPO"
tag_path="$(jq -rn --arg value "$TAG_NAME" '$value | @uri')"
source_name="$(jq -r '.name // .tag_name' release.json)"
source_body="$(jq -r '.body // ""' release.json)"
source_draft="$(jq -r '.draft // false' release.json)"
source_prerelease="$(jq -r '.prerelease // false' release.json)"
source_target="$(jq -r '.target_commitish // ""' release.json)"

request() {
  local method="$1"
  local url="$2"
  shift 2
  if [[ -n "$AUTH_QUERY" ]]; then
    if [[ "$url" == *\?* ]]; then
      url="${url}&${AUTH_QUERY}"
    else
      url="${url}?${AUTH_QUERY}"
    fi
  fi
  curl --fail-with-body --silent --show-error --location \
    --request "$method" "${AUTH[@]}" "$@" "$url"
}

release_url="$API_BASE/$repo_path/releases/tags/$tag_path"
if [[ -n "$AUTH_QUERY" ]]; then
  release_url="${release_url}?${AUTH_QUERY}"
fi
release_file="$(mktemp)"
release_status="$(curl --silent --show-error --location --request GET "${AUTH[@]}" \
  --output "$release_file" --write-out '%{http_code}' "$release_url")"

if [[ "$release_status" == "200" ]]; then
  release_id="$(jq -r '.id' "$release_file")"
  update_url="$API_BASE/$repo_path/releases/$release_id"
  request PATCH "$update_url" \
    -H 'Content-Type: application/json' \
    --data "$(jq -n \
      --arg name "$source_name" \
      --arg body "$source_body" \
      --argjson draft "$source_draft" \
      --argjson prerelease "$source_prerelease" \
      '{name: $name, body: $body, draft: $draft, prerelease: $prerelease}')" \
    > /dev/null
else
  if [[ "$release_status" != "404" ]]; then
    cat "$release_file" >&2
    exit 1
  fi

  create_url="$API_BASE/$repo_path/releases"
  release_id="$(request POST "$create_url" \
    -H 'Content-Type: application/json' \
    --data "$(jq -n \
      --arg tag "$TAG_NAME" \
      --arg name "$source_name" \
      --arg body "$source_body" \
      --arg target "$source_target" \
      --argjson draft "$source_draft" \
      --argjson prerelease "$source_prerelease" \
      '{tag_name: $tag, name: $name, body: $body, target_commitish: $target, draft: $draft, prerelease: $prerelease}' )" \
    | jq -r '.id')"
fi

if [[ -z "$release_id" || "$release_id" == "null" ]]; then
  echo "Could not resolve target release id" >&2
  exit 1
fi

assets_url="$API_BASE/$repo_path/releases/$release_id/$ASSET_LIST_PATH"
for file in "$ASSETS_DIR"/*; do
  [[ -f "$file" ]] || continue
  asset_name="$(basename "$file")"
  asset_name_path="$(jq -rn --arg value "$asset_name" '$value | @uri')"
  upload_file="$file"
  temporary_file=""

  # The updater manifest must point at the mirror that is currently being
  # synchronized, rather than at the original GitHub release.
  if [[ "$asset_name" == "latest.json" ]]; then
    temporary_file="$(mktemp)"
    jq --arg base "$DOWNLOAD_BASE" --arg tag "$TAG_NAME" '
      .platforms |= with_entries(
        if ((.value.url // "") | length) == 0 then .
        else .value.url = ($base + "/releases/download/" + $tag + "/" +
          (.value.url | split("/") | last | split("?") | first))
        end
      )
    ' "$file" > "$temporary_file"
    upload_file="$temporary_file"
  fi

  existing_id="$(request GET "$assets_url" | jq -r --arg name "$asset_name" \
    '.[] | select(.name == $name) | .id' | head -n 1 || true)"

  if [[ -n "$existing_id" ]]; then
    if [[ "$PLATFORM" == "gitea" ]]; then
      request DELETE "$API_BASE/$repo_path/releases/assets/$existing_id" > /dev/null
    else
      request DELETE "$API_BASE/$repo_path/releases/$release_id/attach_files/$existing_id" > /dev/null
    fi
  fi

  if [[ "$PLATFORM" == "gitea" ]]; then
    request POST "$API_BASE/$repo_path/releases/$release_id/assets?name=$asset_name_path" \
      -F "attachment=@$upload_file;filename=$asset_name" > /dev/null
  else
    request POST "$assets_url" \
      -F "file=@$upload_file;filename=$asset_name" > /dev/null
  fi

  if [[ -n "$temporary_file" ]]; then
    rm -f "$temporary_file"
  fi

  echo "Uploaded $asset_name to $PLATFORM"
done

echo "Release $TAG_NAME synchronized to $PLATFORM"
