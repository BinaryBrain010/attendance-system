-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('SERVICE_CENTER', 'BRANCH', 'OUTLET', 'DEPARTMENT', 'STORE', 'WAREHOUSE', 'OFFICE', 'FACTORY', 'OTHER');

-- CreateTable
CREATE TABLE "Unit" (
    "id" VARCHAR(36) NOT NULL,
    "name" TEXT NOT NULL,
    "type" "UnitType" NOT NULL,
    "description" TEXT,
    "address" TEXT,
    "contactNo" TEXT,
    "email" TEXT,
    "attendanceManagerId" VARCHAR(36),
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "isDeleted" TIMESTAMP(3),
    "createdBy" VARCHAR(36),
    "updatedBy" VARCHAR(36),
    "previousUpdates" JSONB,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitEmployee" (
    "id" VARCHAR(36) NOT NULL,
    "unitId" VARCHAR(36) NOT NULL,
    "employeeId" VARCHAR(36) NOT NULL,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "isDeleted" TIMESTAMP(3),

    CONSTRAINT "UnitEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UnitEmployee_unitId_employeeId_key" ON "UnitEmployee"("unitId", "employeeId");

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_attendanceManagerId_fkey" FOREIGN KEY ("attendanceManagerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitEmployee" ADD CONSTRAINT "UnitEmployee_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitEmployee" ADD CONSTRAINT "UnitEmployee_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
