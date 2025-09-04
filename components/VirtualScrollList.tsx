"use client"

import React, { memo, useMemo, useCallback, useRef, useEffect, useState } from "react"
import { useVirtualScrolling } from "@/hooks/usePerformance"

interface VirtualScrollListProps<T> {
  items: T[]
  itemHeight: number
  containerHeight: number
  renderItem: (item: T, index: number) => React.ReactNode
  className?: string
  overscan?: number
  onScroll?: (scrollTop: number) => void
}

// Virtual scrolling component for large lists
const VirtualScrollList = memo(<T,>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  className = "",
  overscan = 5,
  onScroll
}: VirtualScrollListProps<T>) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)

  // Use virtual scrolling hook
  const {
    visibleItems,
    totalHeight,
    offsetY,
    handleScroll: virtualHandleScroll,
    visibleRange
  } = useVirtualScrolling(items, itemHeight, containerHeight, overscan)

  // Enhanced scroll handler
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = event.currentTarget.scrollTop
    setScrollTop(newScrollTop)
    virtualHandleScroll(event)
    onScroll?.(newScrollTop)
  }, [virtualHandleScroll, onScroll])

  // Memoize visible items with their original indices
  const itemsWithIndices = useMemo(() => {
    return visibleItems.map((item, index) => ({
      item,
      originalIndex: visibleRange.startIndex + index
    }))
  }, [visibleItems, visibleRange.startIndex])

  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
          }}
        >
          {itemsWithIndices.map(({ item, originalIndex }) => (
            <div
              key={originalIndex}
              style={{ height: itemHeight }}
              className="virtual-list-item"
            >
              {renderItem(item, originalIndex)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
})

VirtualScrollList.displayName = "VirtualScrollList"

// Grid virtual scrolling for card layouts
interface VirtualGridProps<T> {
  items: T[]
  itemWidth: number
  itemHeight: number
  containerWidth: number
  containerHeight: number
  gap?: number
  renderItem: (item: T, index: number) => React.ReactNode
  className?: string
}

const VirtualGrid = memo(<T,>({
  items,
  itemWidth,
  itemHeight,
  containerWidth,
  containerHeight,
  gap = 16,
  renderItem,
  className = ""
}: VirtualGridProps<T>) => {
  const [scrollTop, setScrollTop] = useState(0)
  
  // Calculate grid dimensions
  const columnsPerRow = Math.floor((containerWidth + gap) / (itemWidth + gap))
  const rowHeight = itemHeight + gap
  const totalRows = Math.ceil(items.length / columnsPerRow)
  const totalHeight = totalRows * rowHeight

  // Calculate visible range
  const startRow = Math.floor(scrollTop / rowHeight)
  const endRow = Math.min(
    totalRows - 1,
    Math.ceil((scrollTop + containerHeight) / rowHeight)
  )

  const visibleItems = useMemo(() => {
    const result = []
    for (let row = startRow; row <= endRow; row++) {
      for (let col = 0; col < columnsPerRow; col++) {
        const index = row * columnsPerRow + col
        if (index < items.length) {
          result.push({
            item: items[index],
            index,
            row,
            col,
            x: col * (itemWidth + gap),
            y: row * rowHeight
          })
        }
      }
    }
    return result
  }, [items, startRow, endRow, columnsPerRow, itemWidth, itemHeight, gap, rowHeight])

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop)
  }, [])

  return (
    <div
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight, width: containerWidth }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map(({ item, index, x, y }) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: itemWidth,
              height: itemHeight
            }}
            className="virtual-grid-item"
          >
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    </div>
  )
})

VirtualGrid.displayName = "VirtualGrid"

// Infinite scroll component
interface InfiniteScrollProps<T> {
  items: T[]
  renderItem: (item: T, index: number) => React.ReactNode
  loadMore: () => Promise<void>
  hasMore: boolean
  loading: boolean
  threshold?: number
  className?: string
}

const InfiniteScroll = memo(<T,>({
  items,
  renderItem,
  loadMore,
  hasMore,
  loading,
  threshold = 200,
  className = ""
}: InfiniteScrollProps<T>) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const loadingRef = useRef(false)

  const handleScroll = useCallback(async () => {
    const container = containerRef.current
    if (!container || loadingRef.current || !hasMore) return

    const { scrollTop, scrollHeight, clientHeight } = container
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight

    if (distanceFromBottom < threshold) {
      loadingRef.current = true
      try {
        await loadMore()
      } finally {
        loadingRef.current = false
      }
    }
  }, [loadMore, hasMore, threshold])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  return (
    <div ref={containerRef} className={`overflow-auto ${className}`}>
      {items.map((item, index) => (
        <div key={index} className="infinite-scroll-item">
          {renderItem(item, index)}
        </div>
      ))}
      {loading && (
        <div className="flex justify-center p-4">
          <div className="animate-spin h-6 w-6 border-2 border-neutral-400 border-t-transparent rounded-full"></div>
        </div>
      )}
      {!hasMore && items.length > 0 && (
        <div className="text-center p-4 text-neutral-400">
          No more items to load
        </div>
      )}
    </div>
  )
})

InfiniteScroll.displayName = "InfiniteScroll"

// Optimized server list with virtual scrolling
interface VirtualServerListProps {
  servers: any[]
  searchQuery: string
  onServerAction: (serverId: number, action: string) => void
  itemHeight?: number
  containerHeight?: number
}

const VirtualServerList = memo(({
  servers,
  searchQuery,
  onServerAction,
  itemHeight = 400,
  containerHeight = 600
}: VirtualServerListProps) => {
  // Filter servers based on search
  const filteredServers = useMemo(() => {
    if (!searchQuery.trim()) return servers
    
    const query = searchQuery.toLowerCase()
    return servers.filter(server => 
      server.name.toLowerCase().includes(query) ||
      server.game.toLowerCase().includes(query)
    )
  }, [servers, searchQuery])

  const renderServerCard = useCallback((server: any, index: number) => {
    return (
      <div className="p-4">
        {/* Server card content would go here */}
        <div className="bg-neutral-800 rounded-lg p-4">
          <h3 className="text-white font-bold">{server.name}</h3>
          <p className="text-neutral-400">{server.game}</p>
          <div className="mt-2 flex gap-2">
            <button 
              onClick={() => onServerAction(server.id, 'start')}
              className="px-3 py-1 bg-green-600 text-white rounded text-sm"
            >
              Start
            </button>
            <button 
              onClick={() => onServerAction(server.id, 'stop')}
              className="px-3 py-1 bg-red-600 text-white rounded text-sm"
            >
              Stop
            </button>
          </div>
        </div>
      </div>
    )
  }, [onServerAction])

  if (filteredServers.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-neutral-400">No servers found</p>
      </div>
    )
  }

  return (
    <VirtualScrollList
      items={filteredServers}
      itemHeight={itemHeight}
      containerHeight={containerHeight}
      renderItem={renderServerCard}
      className="virtual-server-list"
    />
  )
})

VirtualServerList.displayName = "VirtualServerList"

export default VirtualScrollList
export { VirtualGrid, InfiniteScroll, VirtualServerList }
