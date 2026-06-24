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

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = '# === TrickBook Podfile patch (modular headers + non-modular allowance) ===';

const POST_INSTALL_INJECTION = `
    ${MARKER}
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |bc|
        bc.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      end
    end`;

module.exports = function withTrickBookPodfilePatch(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let src = fs.readFileSync(podfile, 'utf8');

      if (src.includes(MARKER)) return cfg;

      // 1) Add `use_modular_headers!` near the top of the target block. We
      //    insert it right after `use_frameworks!` if present, otherwise after
      //    the first `target 'TrickBook' do` line.
      if (!/^\s*use_modular_headers!/m.test(src)) {
        if (/use_frameworks!.*$/m.test(src)) {
          src = src.replace(/(use_frameworks!.*$)/m, '$1\n  use_modular_headers!');
        } else if (/^(\s*target\s+['"][^'"]+['"]\s+do\s*$)/m.test(src)) {
          src = src.replace(
            /^(\s*target\s+['"][^'"]+['"]\s+do\s*$)/m,
            '$1\n  use_modular_headers!',
          );
        }
      }

      // 2) Append the build-setting tweak inside the existing post_install
      //    block (Expo's template generates one). Falls back to a fresh block
      //    if Expo ever stops emitting one.
      if (/post_install\s+do\s+\|installer\|/.test(src)) {
        src = src.replace(
          /(post_install\s+do\s+\|installer\|[\s\S]*?)\n(\s*)end(\s*\n)/,
          (_m, body, indent, trailing) =>
            `${body}${POST_INSTALL_INJECTION}\n${indent}end${trailing}`,
        );
      } else {
        src += `\npost_install do |installer|${POST_INSTALL_INJECTION}\nend\n`;
      }

      fs.writeFileSync(podfile, src);
      return cfg;
    },
  ]);
};
