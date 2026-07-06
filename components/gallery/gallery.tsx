"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  MAX_COLUMNS,
  MIN_COLUMNS,
  clampColumns,
  distributeReadingOrder,
  getSidebarPhotos,
  gridTemplateColumns,
  groupByColumns,
  toPositions,
} from "@/lib/columns";
import { useAdmin } from "@/components/admin/admin-provider";
import {
  deletePhoto,
  setColumnsCount,
  updatePhotoPositions,
} from "@/app/actions/photos";
import {
  CompactSortablePhotoCard,
  PhotoCard,
  SortablePhotoCard,
} from "@/components/gallery/photo-card";
import PhotoImage from "@/components/photo-image";
import UploadButton from "@/components/gallery/upload-button";
import { Button } from "@/components/ui/button";
import type { Photo } from "@/types/photo";

const SIDEBAR_ID = "sidebar-tray";

type ContainerRef =
  | { type: "column"; index: number }
  | { type: "sidebar" };

interface LayoutState {
  columns: Photo[][];
  sidebar: Photo[];
}

function columnId(index: number) {
  return `col-${index}`;
}

function buildLayout(photos: Photo[], columnsCount: number): LayoutState {
  return {
    columns: groupByColumns(photos, columnsCount),
    sidebar: getSidebarPhotos(photos),
  };
}

function sameContainer(a: ContainerRef | null, b: ContainerRef | null) {
  if (!a || !b || a.type !== b.type) return false;
  return a.type === "sidebar" || a.index === (b as { index: number }).index;
}

function DroppableColumn({
  id,
  isEmpty,
  children,
}: {
  id: string;
  isEmpty: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[240px] flex-col gap-4 rounded-lg transition-colors",
        isEmpty && "border border-dashed",
        isOver && "bg-accent/40 ring-2 ring-primary/40"
      )}
    >
      {children}
    </div>
  );
}

function DroppableSidebar({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: SIDEBAR_ID });
  return (
    <aside
      ref={setNodeRef}
      className={cn(
        "h-fit rounded-lg border bg-background p-3 transition-colors xl:sticky xl:top-6",
        isOver && "bg-accent/40 ring-2 ring-primary/40"
      )}
    >
      {children}
    </aside>
  );
}

export default function Gallery({
  photos,
  columnsCount: initialColumnsCount,
}: {
  photos: Photo[];
  columnsCount: number;
}) {
  const isAdmin = useAdmin();

  const signature =
    `${initialColumnsCount}|` +
    photos
      .map((p) => `${p.id}:${p.column_index}:${p.column_order}`)
      .join(",");

  const [layout, setLayoutState] = useState<LayoutState>(() =>
    buildLayout(photos, initialColumnsCount)
  );
  const layoutRef = useRef(layout);
  const [syncedSignature, setSyncedSignature] = useState(signature);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeStartedInSidebar, setActiveStartedInSidebar] = useState(false);
  const [savingColumns, setSavingColumns] = useState(false);

  const applyLayout = useCallback((next: LayoutState) => {
    layoutRef.current = next;
    setLayoutState(next);
  }, []);

  // Re-sync from server data during render (loop-safe) only when the underlying
  // photo set or column count actually changes.
  if (signature !== syncedSignature) {
    layoutRef.current = buildLayout(photos, initialColumnsCount);
    setLayoutState(layoutRef.current);
    setSyncedSignature(signature);
  }

  const [displayColumns, setDisplayColumns] = useState(initialColumnsCount);
  useEffect(() => {
    if (isAdmin) return;
    const mq = window.matchMedia("(max-width: 639px)");
    const apply = () => setDisplayColumns(mq.matches ? 1 : initialColumnsCount);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [isAdmin, initialColumnsCount]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const columns = layout.columns;
  const sidebar = layout.sidebar;
  const columnsCount = columns.length;

  const activePhoto = useMemo(() => {
    if (!activeId) return null;
    for (const column of columns) {
      const found = column.find((p) => p.id === activeId);
      if (found) return found;
    }
    return sidebar.find((p) => p.id === activeId) ?? null;
  }, [activeId, columns, sidebar]);

  function findContainer(source: LayoutState, id: string): ContainerRef | null {
    if (id.startsWith("col-")) {
      const index = Number(id.slice(4));
      return Number.isNaN(index) ? null : { type: "column", index };
    }
    if (id === SIDEBAR_ID) return { type: "sidebar" };

    const index = source.columns.findIndex((column) =>
      column.some((p) => p.id === id)
    );
    if (index !== -1) return { type: "column", index };

    return source.sidebar.some((p) => p.id === id)
      ? { type: "sidebar" }
      : null;
  }

  function getItems(source: LayoutState, container: ContainerRef): Photo[] {
    return container.type === "sidebar"
      ? source.sidebar
      : source.columns[container.index] ?? [];
  }

  function setItems(
    source: LayoutState,
    container: ContainerRef,
    items: Photo[]
  ): LayoutState {
    if (container.type === "sidebar") {
      return { ...source, sidebar: items };
    }
    return {
      ...source,
      columns: source.columns.map((column, index) =>
        index === container.index ? items : column
      ),
    };
  }

  function indexInContainer(
    source: LayoutState,
    container: ContainerRef,
    overId: string
  ) {
    const items = getItems(source, container);
    if (overId === SIDEBAR_ID || overId.startsWith("col-")) return items.length;
    const index = items.findIndex((p) => p.id === overId);
    return index === -1 ? items.length : index;
  }

  async function persist(next: LayoutState) {
    const result = await updatePhotoPositions(
      toPositions(next.columns, next.sidebar)
    );
    if (!result.ok) {
      applyLayout(buildLayout(photos, columnsCount));
      toast.error(result.error || "Could not save layout");
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    setActiveId(id);
    setActiveStartedInSidebar(
      findContainer(layoutRef.current, id)?.type === "sidebar"
    );
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);
    const prev = layoutRef.current;
    const activeContainer = findContainer(prev, activeIdStr);
    const overContainer = findContainer(prev, overIdStr);

    if (
      !activeContainer ||
      !overContainer ||
      sameContainer(activeContainer, overContainer)
    ) {
      return;
    }

    const activeItems = getItems(prev, activeContainer);
    const activeIndex = activeItems.findIndex((p) => p.id === activeIdStr);
    if (activeIndex === -1) return;

    const moved = activeItems[activeIndex];
    const withoutMoved = setItems(
      prev,
      activeContainer,
      activeItems.filter((p) => p.id !== activeIdStr)
    );
    const targetItems = getItems(withoutMoved, overContainer);
    const overIndex = indexInContainer(withoutMoved, overContainer, overIdStr);

    const next = setItems(withoutMoved, overContainer, [
      ...targetItems.slice(0, overIndex),
      moved,
      ...targetItems.slice(overIndex),
    ]);
    applyLayout(next);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    setActiveStartedInSidebar(false);
    const { active, over } = event;
    if (!over) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);
    const prev = layoutRef.current;
    const activeContainer = findContainer(prev, activeIdStr);
    const overContainer = findContainer(prev, overIdStr);
    if (!activeContainer || !overContainer) return;

    let next = prev;
    if (sameContainer(activeContainer, overContainer)) {
      const items = getItems(prev, activeContainer);
      const oldIndex = items.findIndex((p) => p.id === activeIdStr);
      const newIndex = indexInContainer(prev, overContainer, overIdStr);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        next = setItems(prev, activeContainer, arrayMove(items, oldIndex, newIndex));
        applyLayout(next);
      }
    }

    persist(next);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this photo? This cannot be undone.")) return;
    const prev = layoutRef.current;
    const next = {
      columns: prev.columns.map((c) => c.filter((p) => p.id !== id)),
      sidebar: prev.sidebar.filter((p) => p.id !== id),
    };
    applyLayout(next);
    const result = await deletePhoto(id);
    if (!result.ok) {
      applyLayout(prev);
      toast.error(result.error || "Could not delete photo");
    } else {
      toast.success("Photo deleted");
    }
  }

  async function changeColumns(delta: number) {
    const newCount = clampColumns(columnsCount + delta);
    if (newCount === columnsCount || savingColumns) return;

    const prev = layoutRef.current;
    const removedColumn = delta < 0 ? prev.columns[newCount] ?? [] : [];

    if (removedColumn.length > 0) {
      const accepted = confirm(
        `Remove this column? ${removedColumn.length} image${
          removedColumn.length === 1 ? "" : "s"
        } will be moved to the unplaced images sidebar.`
      );
      if (!accepted) return;
    }

    const next: LayoutState =
      delta > 0
        ? { ...prev, columns: [...prev.columns, []] }
        : {
            columns: prev.columns.slice(0, newCount),
            sidebar: [...prev.sidebar, ...removedColumn],
          };

    applyLayout(next);
    setSavingColumns(true);

    const [countResult, posResult] = await Promise.all([
      setColumnsCount(newCount),
      updatePhotoPositions(toPositions(next.columns, next.sidebar)),
    ]);
    setSavingColumns(false);

    if (!countResult.ok || !posResult.ok) {
      toast.error(
        countResult.ok
          ? posResult.ok
            ? "Could not save"
            : posResult.error
          : countResult.error
      );
      applyLayout(buildLayout(photos, initialColumnsCount));
    }
  }

  // ---- Public (non-admin) view ------------------------------------------

  if (!isAdmin) {
    const visiblePhotos = photos.filter(
      (photo) =>
        photo.column_index >= 0 && photo.column_index < initialColumnsCount
    );
    if (visiblePhotos.length === 0) {
      return (
        <div className="flex min-h-[50vh] items-center justify-center px-6 text-center text-muted-foreground">
          No photos yet.
        </div>
      );
    }

    const displayCols =
      displayColumns === initialColumnsCount
        ? groupByColumns(visiblePhotos, initialColumnsCount)
        : distributeReadingOrder(visiblePhotos, displayColumns);

    return (
      <div className="mx-auto w-full max-w-[1400px] px-6 pb-16">
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: gridTemplateColumns(displayCols.length) }}
        >
          {displayCols.map((column, i) => (
            <div key={i} className="flex flex-col gap-4">
              {column.map((photo, j) => (
                <PhotoCard
                  key={photo.id}
                  photo={photo}
                  priority={i < 4 && j === 0}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ---- Admin (editing) view ---------------------------------------------

  const placedPhotosCount = columns.reduce((sum, c) => sum + c.length, 0);
  const totalPhotos = placedPhotosCount + sidebar.length;
  const showSidebar = sidebar.length > 0 || activeStartedInSidebar;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-6 pb-16">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {totalPhotos} photo{totalPhotos === 1 ? "" : "s"} &middot; drag to
          reorder or move between columns
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-md border p-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label="Fewer columns"
              disabled={columnsCount <= MIN_COLUMNS || savingColumns}
              onClick={() => changeColumns(-1)}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="min-w-[3.5rem] text-center text-sm tabular-nums">
              {columnsCount} column{columnsCount === 1 ? "" : "s"}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label="More columns"
              disabled={columnsCount >= MAX_COLUMNS || savingColumns}
              onClick={() => changeColumns(1)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <UploadButton />
        </div>
      </div>

      {totalPhotos === 0 ? (
        <div className="flex min-h-[40vh] items-center justify-center rounded-lg border border-dashed text-center text-muted-foreground">
          No photos yet. Upload your first image.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={() => {
            setActiveId(null);
            setActiveStartedInSidebar(false);
          }}
        >
          <div
            className={cn(
              "grid gap-6",
              showSidebar && "xl:grid-cols-[minmax(0,1fr)_220px]"
            )}
          >
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: gridTemplateColumns(columnsCount) }}
            >
              {columns.map((column, index) => (
                <DroppableColumn
                  key={index}
                  id={columnId(index)}
                  isEmpty={column.length === 0}
                >
                  <SortableContext
                    items={column.map((p) => p.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {column.map((photo) => (
                      <SortablePhotoCard
                        key={photo.id}
                        photo={photo}
                        onDelete={handleDelete}
                      />
                    ))}
                  </SortableContext>
                </DroppableColumn>
              ))}
            </div>

            {showSidebar && (
              <DroppableSidebar>
                <div className="mb-3">
                  <h2 className="text-sm font-medium">Unplaced images</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Drag these back into the masonry when you want to place
                    them.
                  </p>
                </div>
                <SortableContext
                  items={sidebar.map((p) => p.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="grid grid-cols-3 gap-2 xl:grid-cols-2">
                    {sidebar.map((photo) => (
                      <CompactSortablePhotoCard
                        key={photo.id}
                        photo={photo}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DroppableSidebar>
            )}
          </div>

          <DragOverlay>
            {activePhoto ? (
              <div className="overflow-hidden opacity-90 shadow-2xl ring-2 ring-primary">
                <PhotoImage photo={activePhoto} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
