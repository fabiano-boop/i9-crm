"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateLeadScore = calculateLeadScore;
exports.getLeadTemperature = getLeadTemperature;
function calculateLeadScore(place) {
    let score = 0;
    if (place.phone)
        score += 30;
    if (!place.website)
        score += 25;
    if (place.rating && place.rating < 4.0)
        score += 20;
    if (place.userRatingsTotal && place.userRatingsTotal < 50)
        score += 15;
    if (place.rating && place.rating >= 4.0)
        score -= 5;
    return Math.max(0, Math.min(100, score));
}
function getLeadTemperature(score) {
    if (score >= 60)
        return 'HOT';
    if (score >= 35)
        return 'WARM';
    return 'COLD';
}
//# sourceMappingURL=leadScorer.js.map