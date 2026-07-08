/**
 * Asset module declarations
 * Metro resolves these to asset module ids (numbers) at runtime;
 * expo-asset / @react-three/fiber's native loaders accept them directly.
 */

declare module '*.vrm' {
  const assetModule: number;
  export default assetModule;
}
