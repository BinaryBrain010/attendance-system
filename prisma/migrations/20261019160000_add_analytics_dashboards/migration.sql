-- CreateTable
CREATE TABLE "Dashboard" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" VARCHAR(36) NOT NULL,
    "isRoleDefault" BOOLEAN NOT NULL DEFAULT false,
    "isHome" BOOLEAN NOT NULL DEFAULT false,
    "sharedRoleIds" TEXT[],
    "filters" JSONB,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "isDeleted" TIMESTAMP(3),
    "createdById" VARCHAR(36),
    "updatedById" VARCHAR(36),
    "deletedById" VARCHAR(36),

    CONSTRAINT "Dashboard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardWidget" (
    "id" TEXT NOT NULL,
    "dashboardId" TEXT NOT NULL,
    "widgetKey" TEXT,
    "savedWidgetId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "config" JSONB,
    "x" INTEGER NOT NULL DEFAULT 0,
    "y" INTEGER NOT NULL DEFAULT 0,
    "w" INTEGER NOT NULL DEFAULT 4,
    "h" INTEGER NOT NULL DEFAULT 4,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "isDeleted" TIMESTAMP(3),
    "createdById" VARCHAR(36),
    "updatedById" VARCHAR(36),
    "deletedById" VARCHAR(36),

    CONSTRAINT "DashboardWidget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedWidget" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" VARCHAR(36) NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'custom',
    "definition" JSONB NOT NULL,
    "sharedRoleIds" TEXT[],
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "isDeleted" TIMESTAMP(3),
    "createdById" VARCHAR(36),
    "updatedById" VARCHAR(36),
    "deletedById" VARCHAR(36),

    CONSTRAINT "SavedWidget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Dashboard_ownerId_idx" ON "Dashboard"("ownerId");

-- CreateIndex
CREATE INDEX "Dashboard_isRoleDefault_idx" ON "Dashboard"("isRoleDefault");

-- CreateIndex
CREATE INDEX "Dashboard_isDeleted_idx" ON "Dashboard"("isDeleted");

-- CreateIndex
CREATE INDEX "DashboardWidget_dashboardId_idx" ON "DashboardWidget"("dashboardId");

-- CreateIndex
CREATE INDEX "DashboardWidget_savedWidgetId_idx" ON "DashboardWidget"("savedWidgetId");

-- CreateIndex
CREATE INDEX "DashboardWidget_isDeleted_idx" ON "DashboardWidget"("isDeleted");

-- CreateIndex
CREATE INDEX "SavedWidget_ownerId_idx" ON "SavedWidget"("ownerId");

-- CreateIndex
CREATE INDEX "SavedWidget_isDeleted_idx" ON "SavedWidget"("isDeleted");

-- AddForeignKey
ALTER TABLE "DashboardWidget" ADD CONSTRAINT "DashboardWidget_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "Dashboard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

