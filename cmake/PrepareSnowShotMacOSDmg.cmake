# Keep the build target/executable and development bundle names stable. Only the
# distributable bundle gets the product name; renaming does not alter its seal.
set(_snow_staged_app "${CPACK_TEMPORARY_DIRECTORY}/WingShot.app")
if(NOT EXISTS "${_snow_staged_app}/Contents/Info.plist")
    message(FATAL_ERROR "The staged Snow Shot application is missing: ${_snow_staged_app}")
endif()
file(RENAME "${_snow_staged_app}" "${CPACK_TEMPORARY_DIRECTORY}/Snow Shot.app")
