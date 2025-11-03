# Manual Testing and Validation Checklist

## Overview
This document provides a comprehensive checklist for manually testing and validating the Unified Market Aggregation feature. Use this checklist to ensure all functionality works correctly before deployment.

---

## 1. Polymarket + Kalshi Data Display

### Backend Data Fetching
- [ ] **Polymarket API Connection**
  - [ ] Markets fetch successfully from Polymarket
  - [ ] Response contains valid market data
  - [ ] Rate limiting respected (100 req/min)
  - [ ] Error handling works for failed requests
  
- [ ] **Kalshi API Connection**
  - [ ] Authentication succeeds with API key
  - [ ] Markets fetch successfully from Kalshi
  - [ ] Response contains valid market data
  - [ ] Rate limiting respected (50 req/min)
  - [ ] Error handling works for failed requests

### Data Normalization
- [ ] **Polymarket Normalization**
  - [ ] Question field extracted correctly
  - [ ] Outcomes normalized to YES/NO format
  - [ ] Prices converted to 0.00-1.00 range
  - [ ] Volume converted to USD
  - [ ] Category extracted correctly
  - [ ] Platform field set to 'polymarket'
  
- [ ] **Kalshi Normalization**
  - [ ] Title field extracted as question
  - [ ] Outcomes normalized to YES/NO format
  - [ ] Prices converted to 0.00-1.00 range
  - [ ] Volume converted to USD
  - [ ] Category extracted correctly
  - [ ] Platform field set to 'kalshi'

### Frontend Display
- [ ] **Market Cards**
  - [ ] Platform logos display correctly
  - [ ] Polymarket logo shows for Polymarket-only markets
  - [ ] Kalshi logo shows for Kalshi-only markets
  - [ ] Both logos show for multi-platform markets
  - [ ] Market questions display clearly
  - [ ] Prices formatted as percentages or cents
  - [ ] Volume displays with proper formatting
  
- [ ] **Market Detail Page**
  - [ ] All platform data loads correctly
  - [ ] Side-by-side comparison visible
  - [ ] Platform sections clearly separated
  - [ ] Last update timestamps shown
  - [ ] All metrics display correctly

---

## 2. Market Matching Accuracy

### Matching Algorithm
- [ ] **Identical Questions**
  - [ ] Exact matches achieve >95% confidence
  - [ ] Markets correctly unified
  - [ ] unified_id generated properly
  
- [ ] **Similar Questions**
  - [ ] Similar questions achieve 85-95% confidence
  - [ ] Minor wording differences handled
  - [ ] Entity extraction works (names, dates, events)
  - [ ] Markets correctly unified
  
- [ ] **Different Questions**
  - [ ] Different questions score <85% confidence
  - [ ] No false matches created
  - [ ] Markets remain separate

### Entity Extraction
- [ ] **Person Names**
  - [ ] Capitalized names extracted (e.g., "Donald Trump")
  - [ ] Multiple names handled correctly
  - [ ] Names compared across platforms
  
- [ ] **Dates**
  - [ ] Various date formats recognized
  - [ ] Years extracted (e.g., "2024")
  - [ ] Full dates extracted (e.g., "November 5, 2024")
  - [ ] Dates compared for matching
  
- [ ] **Events**
  - [ ] Key event words identified (election, championship, etc.)
  - [ ] Events compared across platforms

### Real Market Testing
- [ ] **Sample Matches Review**
  - [ ] Review 5-10 matched markets manually
  - [ ] Verify questions are actually the same
  - [ ] Check match confidence scores are reasonable
  - [ ] Identify any false positives
  - [ ] Identify any false negatives (missed matches)

---

## 3. Arbitrage Detection

### Detection Algorithm
- [ ] **Synthetic Test Cases**
  - [ ] Obvious arbitrage detected (e.g., Poly YES 0.45, Kalshi NO 0.50)
  - [ ] Profit percentage calculated correctly
  - [ ] Only opportunities >2% flagged (fee threshold)
  - [ ] No false positives on aligned prices
  
- [ ] **Real Market Scanning**
  - [ ] All multi-platform markets scanned
  - [ ] Arbitrage opportunities identified
  - [ ] Opportunities sorted by profit percentage
  - [ ] Results logged/displayed

### Arbitrage Display
- [ ] **Market Cards**
  - [ ] Arbitrage badge shows on cards with opportunities
  - [ ] Profit percentage displayed correctly
  - [ ] Badge is visually prominent
  - [ ] Badge only shows when profit >2%
  
- [ ] **Market Detail Page**
  - [ ] ArbitrageAlert component displays
  - [ ] Alert is visually prominent (🚨 icon)
  - [ ] Profit percentage shown clearly
  
- [ ] **Trading Instructions**
  - [ ] Step-by-step instructions generated
  - [ ] Buy platform specified
  - [ ] Sell platform specified
  - [ ] Prices included in instructions
  - [ ] Warning about fees and risks displayed

---

## 4. Platform Failure Handling

### Kalshi Offline Scenario
- [ ] **System Behavior**
  - [ ] System continues to function
  - [ ] Polymarket markets still display
  - [ ] No crashes or errors
  - [ ] Graceful degradation message shown
  
- [ ] **Platform Health**
  - [ ] Kalshi marked as "degraded" or "offline"
  - [ ] Health status visible to users
  - [ ] Warning icons displayed
  - [ ] Last successful fetch timestamp shown
  
- [ ] **Data Display**
  - [ ] Markets show Polymarket data only
  - [ ] No Kalshi logo on market cards
  - [ ] No Kalshi section in detail pages
  - [ ] Combined volume = Polymarket volume only

### Polymarket Offline Scenario
- [ ] **System Behavior**
  - [ ] System continues to function
  - [ ] Kalshi markets still display
  - [ ] No crashes or errors
  - [ ] Graceful degradation message shown
  
- [ ] **Platform Health**
  - [ ] Polymarket marked as "degraded" or "offline"
  - [ ] Health status visible to users
  - [ ] Warning icons displayed
  - [ ] Last successful fetch timestamp shown
  
- [ ] **Data Display**
  - [ ] Markets show Kalshi data only
  - [ ] No Polymarket logo on market cards
  - [ ] No Polymarket section in detail pages
  - [ ] Combined volume = Kalshi volume only

### Recovery Testing
- [ ] **Platform Returns Online**
  - [ ] System detects platform recovery
  - [ ] Health status updates to "healthy"
  - [ ] Multi-platform markets restored
  - [ ] Matching resumes automatically
  - [ ] No manual intervention required

### Both Platforms Offline
- [ ] **Catastrophic Failure**
  - [ ] Appropriate error message displayed
  - [ ] System doesn't crash
  - [ ] Cached data shown if available
  - [ ] Clear indication of system status

---

## 5. Mobile Responsiveness

### Layout Testing
- [ ] **Market Cards (Mobile)**
  - [ ] Cards stack vertically
  - [ ] Platform logos visible and sized correctly
  - [ ] Text readable without zooming
  - [ ] Prices and metrics display properly
  - [ ] Touch targets adequate size
  
- [ ] **Market Detail Page (Mobile)**
  - [ ] Platform comparison sections stack vertically
  - [ ] All data visible without horizontal scroll
  - [ ] Charts render correctly
  - [ ] Orderbooks display properly
  - [ ] Arbitrage alerts visible
  
- [ ] **Navigation (Mobile)**
  - [ ] Category filters accessible
  - [ ] Search functionality works
  - [ ] Back navigation works
  - [ ] Scrolling smooth

### Device Testing
- [ ] **Phone (Portrait)**
  - [ ] iPhone (Safari)
  - [ ] Android (Chrome)
  - [ ] Small screens (<375px width)
  
- [ ] **Phone (Landscape)**
  - [ ] Layout adapts appropriately
  - [ ] No content cut off
  
- [ ] **Tablet**
  - [ ] iPad (Safari)
  - [ ] Android tablet (Chrome)
  - [ ] Layout uses available space well

---

## 6. Real-Time Updates

### Polling Service
- [ ] **Update Intervals**
  - [ ] Polymarket polls every 5 seconds
  - [ ] Kalshi polls every 10 seconds
  - [ ] Updates don't cause UI flicker
  - [ ] Performance remains smooth
  
- [ ] **Data Freshness**
  - [ ] Prices update in real-time
  - [ ] Volume updates reflect changes
  - [ ] Last update timestamps accurate
  - [ ] Stale data warnings appear when appropriate

### Detail Page Auto-Refresh
- [ ] **Automatic Updates**
  - [ ] Page refreshes every 5 seconds
  - [ ] User not disrupted during refresh
  - [ ] Scroll position maintained
  - [ ] Charts update smoothly
  
- [ ] **Staleness Warnings**
  - [ ] Warning shows if data >60 seconds old
  - [ ] Warning icon visible on affected platforms
  - [ ] Warning message clear and helpful

---

## 7. Performance Testing

### Load Times
- [ ] **Initial Page Load**
  - [ ] Markets load within 3 seconds
  - [ ] Loading indicators shown
  - [ ] Progressive rendering (show data as it arrives)
  
- [ ] **Detail Page Load**
  - [ ] Detail page loads within 2 seconds
  - [ ] Orderbook data loads quickly
  - [ ] Charts render without delay

### Matching Performance
- [ ] **Large Dataset**
  - [ ] 100+ markets match in <5 seconds
  - [ ] No UI freezing during matching
  - [ ] Results display progressively

### Memory Usage
- [ ] **Long Session**
  - [ ] No memory leaks after 30 minutes
  - [ ] Cache doesn't grow unbounded
  - [ ] Performance remains consistent

---

## 8. Data Integrity

### Price Validation
- [ ] **Price Ranges**
  - [ ] All prices between 0.00 and 1.00
  - [ ] No negative prices
  - [ ] No prices >1.00
  - [ ] Price formatting consistent
  
- [ ] **Best Price Calculation**
  - [ ] Best YES price is actually lowest
  - [ ] Best NO price is actually lowest
  - [ ] Platform attribution correct
  - [ ] Updates when prices change

### Volume Calculations
- [ ] **Combined Volume**
  - [ ] Sum of all platform volumes
  - [ ] Calculation accurate
  - [ ] Updates in real-time
  - [ ] Formatted correctly (commas, decimals)

### Liquidity Scores
- [ ] **Score Calculation**
  - [ ] Scores between 1 and 5
  - [ ] Formula applied correctly: (volume × 0.4) + (1/spread × 0.6)
  - [ ] Higher liquidity = higher score
  - [ ] Displayed as star rating

### Spread Calculations
- [ ] **Spread Accuracy**
  - [ ] Calculated as (ask - bid)
  - [ ] Displayed in cents
  - [ ] Warning shown if >10 cents
  - [ ] Updates with price changes

---

## 9. Edge Cases

### Unusual Market Structures
- [ ] **Multi-Outcome Markets**
  - [ ] Markets with >2 outcomes handled
  - [ ] Matching still works
  - [ ] Display appropriate
  
- [ ] **Missing Data**
  - [ ] Markets without orderbooks display correctly
  - [ ] Markets without images show placeholder
  - [ ] Missing categories handled gracefully

### Timing Issues
- [ ] **Expired Markets**
  - [ ] Resolved markets filtered out
  - [ ] End date validation works
  - [ ] No matching on expired markets
  
- [ ] **Future Markets**
  - [ ] Markets with far future dates handled
  - [ ] Date display correct

### Network Issues
- [ ] **Slow Connection**
  - [ ] Loading indicators shown
  - [ ] Timeouts handled gracefully
  - [ ] Retry logic works
  
- [ ] **Intermittent Failures**
  - [ ] Exponential backoff applied
  - [ ] Max retry limit respected
  - [ ] Error messages helpful

---

## 10. User Experience

### Visual Design
- [ ] **Consistency**
  - [ ] Platform logos consistent size
  - [ ] Color scheme consistent
  - [ ] Typography consistent
  - [ ] Spacing consistent
  
- [ ] **Clarity**
  - [ ] Information hierarchy clear
  - [ ] Important data prominent
  - [ ] Labels descriptive
  - [ ] Icons intuitive

### Interactions
- [ ] **Clickable Elements**
  - [ ] Market cards clickable
  - [ ] Hover states visible
  - [ ] Click feedback immediate
  - [ ] Navigation smooth
  
- [ ] **Tooltips/Help**
  - [ ] Complex metrics explained
  - [ ] Platform badges have tooltips
  - [ ] Arbitrage warnings clear
  - [ ] Help text accessible

### Error Messages
- [ ] **User-Friendly**
  - [ ] Technical jargon avoided
  - [ ] Clear explanation of issue
  - [ ] Suggested actions provided
  - [ ] Contact info if needed

---

## 11. Browser Compatibility

### Desktop Browsers
- [ ] **Chrome**
  - [ ] Latest version
  - [ ] All features work
  
- [ ] **Firefox**
  - [ ] Latest version
  - [ ] All features work
  
- [ ] **Safari**
  - [ ] Latest version
  - [ ] All features work
  
- [ ] **Edge**
  - [ ] Latest version
  - [ ] All features work

### Mobile Browsers
- [ ] **Mobile Safari (iOS)**
  - [ ] All features work
  - [ ] Touch interactions smooth
  
- [ ] **Chrome (Android)**
  - [ ] All features work
  - [ ] Touch interactions smooth

---

## 12. Security & Privacy

### API Keys
- [ ] **Kalshi API Key**
  - [ ] Stored in environment variables
  - [ ] Not exposed in frontend code
  - [ ] Not logged in console
  - [ ] Not visible in network requests

### Rate Limiting
- [ ] **Backend Protection**
  - [ ] Rate limits enforced
  - [ ] Abuse prevention active
  - [ ] Error responses appropriate

### Data Handling
- [ ] **User Data**
  - [ ] No PII collected unnecessarily
  - [ ] Data not shared with third parties
  - [ ] Privacy policy updated if needed

---

## Testing Execution Log

### Test Session Information
- **Date:** _______________
- **Tester:** _______________
- **Environment:** _______________
- **Browser/Device:** _______________

### Issues Found
| # | Severity | Description | Steps to Reproduce | Status |
|---|----------|-------------|-------------------|--------|
| 1 |          |             |                   |        |
| 2 |          |             |                   |        |
| 3 |          |             |                   |        |

### Overall Assessment
- [ ] **Ready for Production** - All critical tests passed
- [ ] **Minor Issues** - Non-critical issues found, can deploy with fixes planned
- [ ] **Major Issues** - Critical issues found, do not deploy

### Notes
_Add any additional observations, concerns, or recommendations here:_

---

## Automated Testing Script

Run the automated validation script:

```bash
cd backend
node manual-testing-validation.js
```

This script will automatically test:
1. Polymarket + Kalshi data fetching and normalization
2. Market matching accuracy with sample cases
3. Arbitrage detection with synthetic and real data
4. Platform failure scenarios
5. Data integrity validation

Review the output and address any failures before proceeding with manual testing.

---

## Sign-Off

- [ ] **Backend Developer:** _______________  Date: _______________
- [ ] **Frontend Developer:** _______________  Date: _______________
- [ ] **QA Tester:** _______________  Date: _______________
- [ ] **Product Owner:** _______________  Date: _______________

---

## Next Steps After Testing

1. **Document Issues:** Log all issues found in issue tracker
2. **Prioritize Fixes:** Categorize by severity (critical, major, minor)
3. **Fix Critical Issues:** Address all critical issues before deployment
4. **Regression Test:** Re-test after fixes applied
5. **Deploy to Staging:** Test in staging environment
6. **Production Deployment:** Deploy when all tests pass
7. **Monitor:** Watch logs and metrics after deployment
