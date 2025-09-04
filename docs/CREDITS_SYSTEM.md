# Real-Time Credits System

A comprehensive real-time user credits display and management system for CythroDash.

## Features

- **Real-time Display**: Credits are displayed prominently in the header and update automatically
- **Automatic Polling**: Credits are refreshed every 30 seconds to stay current
- **Optimistic Updates**: Immediate UI feedback for better user experience
- **Error Handling**: Graceful error handling with fallback mechanisms
- **Mobile Support**: Responsive design with mobile-specific display in user dropdown
- **Animation**: Visual feedback when credits change (scale animation, color changes)
- **Sync Integration**: Automatic synchronization with user store changes

## Components

### CreditsDisplay
Main component that displays user credits in the header.

```tsx
import CreditsDisplay from '@/components/CreditsDisplay'

// Prominent display (default in header)
<CreditsDisplay variant="prominent" size="md" />

// Compact display (for mobile dropdown)
<CreditsDisplay variant="compact" size="sm" showLabel={true} />
```

**Props:**
- `variant`: 'default' | 'prominent' | 'compact'
- `size`: 'sm' | 'md' | 'lg'
- `showLabel`: boolean - Show "Credits" label
- `className`: Additional CSS classes

## Stores

### Credits Store (`stores/credits-store.ts`)
Manages credits state and real-time updates.

**State:**
- `credits`: Current credit balance
- `isLoading`: Loading state
- `error`: Error message if any
- `isPolling`: Whether polling is active

**Actions:**
- `fetchCredits()`: Fetch from API
- `updateCredits(amount)`: Set exact amount
- `addCredits(amount)`: Add credits
- `subtractCredits(amount)`: Subtract credits
- `startPolling()`: Start 30-second polling
- `stopPolling()`: Stop polling

## Hooks

### useCreditsUpdate
Hook for triggering credit updates from components.

```tsx
import { useCreditsUpdate } from '@/hooks/useCreditsUpdate'

const { addCredits, subtractCredits, setCredits, refreshCredits } = useCreditsUpdate()

// Add credits with sync
await addCredits(100, 'Daily bonus')

// Subtract credits with sync
await subtractCredits(50, 'Server purchase')

// Set exact amount
await setCredits(1000, 'Admin adjustment')

// Refresh from server
await refreshCredits()
```

### useCreditsSync
Hook for syncing credits after API calls.

```tsx
import { useCreditsSync } from '@/hooks/useCreditsUpdate'

const { syncCreditsAfterApiCall } = useCreditsSync()

// After API call that changes credits
const response = await fetch('/api/user/daily-login', { ... })
const result = await response.json()

if (result.success) {
  await syncCreditsAfterApiCall(result)
}
```

## Integration Examples

### Daily Login Bonus
```tsx
const handleDailyLogin = async () => {
  const response = await fetch('/api/user/daily-login', {
    method: 'POST',
    body: JSON.stringify({ action: 'claim' })
  })
  
  const result = await response.json()
  if (result.success) {
    await syncCreditsAfterApiCall(result)
    showSuccess(`+${result.data.coins_awarded} credits earned!`)
  }
}
```

### Server Purchase (Optimistic Update)
```tsx
const handlePurchase = async (cost: number) => {
  // Immediate UI feedback
  await subtractCredits(cost, 'Server purchase')
  
  try {
    const response = await fetch('/api/servers/create', { ... })
    const result = await response.json()
    
    if (result.success) {
      await syncCreditsAfterApiCall(result)
    } else {
      // Revert on failure
      await addCredits(cost, 'Purchase failed')
    }
  } catch (error) {
    // Revert on error
    await addCredits(cost, 'Purchase error')
  }
}
```

### Referral Rewards
The system automatically syncs when referral rewards are claimed through the existing `useReferralStats` hook.

## API Integration

The system works with existing API endpoints:

- `GET /api/user/me` - Fetches current user data including credits
- Any endpoint that returns `user.coins` or `data.new_balance`

## Automatic Synchronization

The credits system automatically syncs with:

1. **User Store Changes**: When `currentUser.coins` changes
2. **API Responses**: When using `syncCreditsAfterApiCall()`
3. **Polling**: Every 30 seconds when user is authenticated
4. **Referral Claims**: Automatic sync after reward claims

## Performance Considerations

- **Debounced Fetching**: Prevents duplicate requests within 5 seconds
- **Conditional Polling**: Only polls when user is authenticated
- **Optimistic Updates**: Immediate UI feedback without waiting for server
- **Error Recovery**: Automatic retry and fallback mechanisms
- **Memory Cleanup**: Automatic cleanup on page unload

## Visual Features

- **Prominent Display**: Golden gradient background in header
- **Animation**: Scale and color changes when credits update
- **Loading States**: Pulse animation during loading
- **Error States**: Red error indicator with refresh button
- **Tooltips**: Detailed information on hover
- **Mobile Responsive**: Compact display in mobile dropdown

## Error Handling

- Network errors are caught and displayed
- Failed updates are reverted automatically
- Manual refresh option available on errors
- Graceful degradation when API is unavailable

## Testing

Use the example component at `components/examples/CreditsUpdateExample.tsx` to test all credit update scenarios.

## Best Practices

1. **Always use hooks**: Use `useCreditsUpdate` or `useCreditsSync` instead of direct store access
2. **Handle errors**: Always implement error handling and revert optimistic updates
3. **Provide feedback**: Show success/error messages to users
4. **Use optimistic updates**: For better UX, update UI immediately then confirm with server
5. **Sync after API calls**: Always call `syncCreditsAfterApiCall()` after credit-affecting operations
