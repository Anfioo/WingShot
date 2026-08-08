#!/usr/bin/env bash
set -euo pipefail

# Log every line with a [platform] prefix so parallel mirror syncs
# (gitee + gitea) stay distinguishable in the workflow log.
log()     { printf '[%s] %s\n' "$PLATFORM" "$*"; }
log_err() { printf '[%s] %s\n' "$PLATFORM" "$*" >&2; }

: "${PLATFORM:?PLATFORM is required (gitee or gitea)}"
: "${PLATFORM_TOKEN:?PLATFORM_TOKEN is required}"
: "${TAG_NAME:?TAG_NAME is required}"
: "${ASSETS_DIR:?ASSETS_DIR is required}"

if [[ ! -f release.json ]]; then
  log_err "release.json is missing"
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
  log_err "Unsupported platform: $PLATFORM"
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
    --connect-timeout 30 --max-time 1800 --retry 3 --retry-all-errors \
    --request "$method" "${AUTH[@]}" "$@" "$url"
}

# Upload an asset with a visible progress bar. request() uses --silent, which
# makes large uploads look stuck in CI logs; --progress-bar forces live
# progress output (shown even without a TTY). On failure the server's error
# body is printed so the cause (400/409/...) can be located in the log.
upload() {
  local url="$1"
  local form="$2"
  shift 2
  if [[ -n "$AUTH_QUERY" ]]; then
    if [[ "$url" == *\?* ]]; then
      url="${url}&${AUTH_QUERY}"
    else
      url="${url}?${AUTH_QUERY}"
    fi
  fi
  local body
  if body="$(curl --fail-with-body --show-error --location \
    --connect-timeout 30 --max-time 1800 --retry 3 --retry-all-errors \
    --request POST "${AUTH[@]}" \
    -F "$form" \
    --progress-bar \
    "$@" "$url")"; then
    return 0
  fi
  printf '%s\n' "$body" >&2
  exit 1
}

log "Resolving release $TAG_NAME..."
release_url="$API_BASE/$repo_path/releases/tags/$tag_path"
if [[ -n "$AUTH_QUERY" ]]; then
  release_url="${release_url}?${AUTH_QUERY}"
fi
release_file="$(mktemp)"
trap 'rm -f "$release_file"' EXIT
release_status="$(curl --silent --show-error --location \
  --connect-timeout 30 --max-time 120 --retry 3 --retry-all-errors \
  --request GET "${AUTH[@]}" \
  --output "$release_file" --write-out '%{http_code}' "$release_url")"

# Gitee's GET /releases/tags/{tag} returns HTTP 200 with a JSON `null`
# body when the tag exists but has no release yet (GitHub/Gitea return 404
# instead), so decide by whether an id could be parsed, not by the status
# code alone. Tolerate both object and array shapes defensively; any other
# shape (e.g. an error object) is treated as a failure, never as "absent".
release_id="$(jq -r '
  if type == "object" and .id != null then .id
  elif type == "array" and length > 0 and .[0].id != null then .[0].id
  else empty
  end
' "$release_file")"

if [[ -n "$release_id" ]]; then
  log "Updating existing release (id: $release_id)..."
  update_url="$API_BASE/$repo_path/releases/$release_id"
  update_data="$(jq -n \
    --arg tag "$TAG_NAME" \
    --arg name "$source_name" \
    --arg body "$source_body" \
    --argjson draft "$source_draft" \
    --argjson prerelease "$source_prerelease" \
    '{tag_name: $tag, name: $name, body: $body, draft: $draft, prerelease: $prerelease}')"
  if [[ "$PLATFORM" != "gitea" ]]; then
    # Gitee releases have no draft flag; drop it to avoid a 400.
    update_data="$(printf '%s' "$update_data" | jq 'del(.draft)')"
  fi
  request PATCH "$update_url" \
    -H 'Content-Type: application/json' \
    --data "$update_data" > /dev/null
elif [[ "$release_status" == "404" ]] || { [[ -s "$release_file" ]] && jq -e 'type == "null"' "$release_file" >/dev/null 2>&1; }; then

  create_url="$API_BASE/$repo_path/releases"
  log "Creating release $TAG_NAME..."
  create_data="$(jq -n \
    --arg tag "$TAG_NAME" \
    --arg name "$source_name" \
    --arg body "$source_body" \
    --arg target "$source_target" \
    --argjson draft "$source_draft" \
    --argjson prerelease "$source_prerelease" \
    '{tag_name: $tag, name: $name, body: $body, target_commitish: $target, draft: $draft, prerelease: $prerelease}')"
  if [[ "$PLATFORM" != "gitea" ]]; then
    create_data="$(printf '%s' "$create_data" | jq 'del(.draft)')"
  fi
  release_id="$(request POST "$create_url" \
    -H 'Content-Type: application/json' \
    --data "$create_data" | jq -r '.id')"
else
  cat "$release_file" >&2
  exit 1
fi

if [[ -z "$release_id" || "$release_id" == "null" ]]; then
  log_err "Could not resolve target release id"
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
    log "Replacing existing $asset_name..."
    if [[ "$PLATFORM" == "gitea" ]]; then
      request DELETE "$API_BASE/$repo_path/releases/assets/$existing_id" > /dev/null
    else
      request DELETE "$API_BASE/$repo_path/releases/$release_id/attach_files/$existing_id" > /dev/null
    fi
  fi

  log "Uploading $asset_name ($(du -h "$upload_file" | cut -f1))..."
  upload_start="$(date +%s)"
  if [[ "$PLATFORM" == "gitea" ]]; then
    upload "$API_BASE/$repo_path/releases/$release_id/assets?name=$asset_name_path" \
      "attachment=@$upload_file;filename=$asset_name"
  else
    upload "$assets_url" "file=@$upload_file;filename=$asset_name"
  fi
  upload_elapsed="$(( $(date +%s) - upload_start ))"

  if [[ -n "$temporary_file" ]]; then
    rm -f "$temporary_file"
  fi

  log "Uploaded $asset_name (${upload_elapsed}s)"
done

log "Release $TAG_NAME synchronized"
