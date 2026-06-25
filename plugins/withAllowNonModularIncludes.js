/**
 * Expo config plugin — two-part Podfile patch required for our use_frameworks!
 * setup on iOS:
 *
 *   1) Adds `use_modular_headers!` globally so every Obj-C pod generates a
 *      module map. Without this, react-native-maps (which subclasses
 *      RCTViewManager from React-Core) can't resolve React-Core symbols when
 *      compiled as a framework — you get
 *        "declaration of 'RCTViewManager' must be imported from module ..."
 *
 *   2) Sets CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES=YES on every
 *      pod target as a belt-and-suspenders defense for the few pods that still
 *      include non-modular headers despite the global flag.
 *
 * Both are no-ops if the platform doesn't have use_frameworks! enabled, but we
 * always have it on via expo-build-properties.
 *
 * Idempotent via a marker comment.
 */

// Per Expo's recommendation, import from `expo/config-plugins` (the sub-export
// of the expo package itself) rather than the top-level `@expo/config-plugins`
// package. The latter may not resolve correctly on EAS workers when it's not
// listed in `dependencies` (only as a transitive dep).
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

console.log('[withAllowNonModularIncludes] plugin file loaded');

const MARKER = '# === TrickBook Podfile patch (modular headers + non-modular allowance) ===';
const PRE_INSTALL_MARKER = '# === TrickBook pre_install (maps as static_library) ===';

const POST_INSTALL_INJECTION = `
    ${MARKER}
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |bc|
        bc.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      end
    end`;

// Force react-native-maps + react-native-google-maps to build as a static
// library even when use_frameworks! is enabled. This is the canonical fix
// documented by the react-native-maps maintainers for the RCTViewManager
// "must be imported from module" error.
const PRE_INSTALL_BLOCK = `
${PRE_INSTALL_MARKER}
pre_install do |installer|
  installer.pod_targets.each do |pod|
    if ['react-native-maps', 'react-native-google-maps'].include?(pod.name)
      def pod.build_type
        Pod::BuildType.static_library
      end
    end
  end
end
`;

module.exports = function withTrickBookPodfilePatch(config) {
  console.log('[withAllowNonModularIncludes] plugin function invoked');
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      console.log('[withAllowNonModularIncludes] running dangerous mod against Podfile');
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      const before = fs.readFileSync(podfile, 'utf8');

      console.log('[withAllowNonModularIncludes] === Podfile BEFORE (first 60 lines) ===');
      console.log(before.split('\n').slice(0, 60).join('\n'));
      console.log('[withAllowNonModularIncludes] === end Podfile snippet ===');

      if (before.includes(MARKER)) {
        console.log('[withAllowNonModularIncludes] marker already present, skipping');
        return cfg;
      }

      let src = before;
      const initialLength = src.length;

      // 1) Unconditionally inject `use_modular_headers!` immediately after the
      //    target block opens. This is the most reliable insertion point —
      //    `use_frameworks!` may or may not be present yet depending on plugin
      //    order, but the target block always exists in a generated Podfile.
      if (!/^\s*use_modular_headers!/m.test(src)) {
        const targetRegex = /^([ \t]*target\s+['"][^'"]+['"]\s+do[ \t]*$)/m;
        if (targetRegex.test(src)) {
          src = src.replace(targetRegex, "$1\n  use_modular_headers!");
          console.log('[withAllowNonModularIncludes] injected use_modular_headers! after target line');
        } else {
          console.log('[withAllowNonModularIncludes] WARN: target line not found, use_modular_headers! NOT added');
        }
      } else {
        console.log('[withAllowNonModularIncludes] use_modular_headers! already present');
      }

      // 2) Append the build-setting tweak inside the existing post_install
      //    block. Match the LAST `end` that closes the post_install block
      //    (CocoaPods only allows one).
      if (/post_install\s+do\s+\|installer\|/.test(src)) {
        const beforePostInstall = src;
        src = src.replace(
          /(post_install\s+do\s+\|installer\|[\s\S]*?)\n([ \t]*)end([ \t]*\n)/,
          (_m, body, indent, trailing) =>
            `${body}${POST_INSTALL_INJECTION}\n${indent}end${trailing}`,
        );
        if (src === beforePostInstall) {
          console.log('[withAllowNonModularIncludes] WARN: post_install regex did not match, falling back to append');
          src += `\npost_install do |installer|${POST_INSTALL_INJECTION}\nend\n`;
        } else {
          console.log('[withAllowNonModularIncludes] injected build settings into existing post_install');
        }
      } else {
        console.log('[withAllowNonModularIncludes] no post_install found, appending fresh block');
        src += `\npost_install do |installer|${POST_INSTALL_INJECTION}\nend\n`;
      }

      // 3) Add a pre_install block that forces react-native-maps and
      //    react-native-google-maps to build as static_library. This is the
      //    react-native-maps maintainers' documented workaround for the
      //    "must be imported from module" error under use_frameworks!.
      if (!src.includes(PRE_INSTALL_MARKER)) {
        // Insert BEFORE the post_install block so order is conventional.
        if (/post_install\s+do\s+\|installer\|/.test(src)) {
          src = src.replace(
            /(post_install\s+do\s+\|installer\|)/,
            `${PRE_INSTALL_BLOCK}\n$1`,
          );
          console.log('[withAllowNonModularIncludes] injected pre_install before post_install');
        } else {
          src += `\n${PRE_INSTALL_BLOCK}\n`;
          console.log('[withAllowNonModularIncludes] appended pre_install block at end');
        }
      }

      fs.writeFileSync(podfile, src);
      console.log(
        `[withAllowNonModularIncludes] Podfile patched — size ${initialLength} → ${src.length} bytes; use_modular_headers! ${/^\s*use_modular_headers!/m.test(src) ? 'PRESENT' : 'MISSING'}; post_install marker ${src.includes(MARKER) ? 'PRESENT' : 'MISSING'}; pre_install marker ${src.includes(PRE_INSTALL_MARKER) ? 'PRESENT' : 'MISSING'}`,
      );
      return cfg;
    },
  ]);
};
