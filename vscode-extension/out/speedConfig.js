"use strict";
/**
 * TypeByAman — Speed Configuration Helper
 * Author: Aman Kumar | github.com/Amankr0075
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SPEED_PRESETS = void 0;
exports.resolveDelay = resolveDelay;
exports.SPEED_PRESETS = {
    'Very Slow': 1000,
    'Slow': 250,
    'Normal': 50,
    'Fast': 20,
    'Very Fast': 5,
};
function resolveDelay(preset, customDelay) {
    if (preset === 'Custom')
        return Math.max(1, customDelay);
    return exports.SPEED_PRESETS[preset] ?? customDelay;
}
//# sourceMappingURL=speedConfig.js.map