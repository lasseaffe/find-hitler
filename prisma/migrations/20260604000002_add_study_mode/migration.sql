-- AlterTable
ALTER TABLE "FactCheckArticle" ADD COLUMN     "curriculum" TEXT,
ADD COLUMN     "generatedFrom" TEXT,
ADD COLUMN     "grade" TEXT,
ADD COLUMN     "sourceFile" TEXT;

-- CreateTable
CREATE TABLE "StudyPack" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "subject" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "curriculum" TEXT,
    "authorId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "source" TEXT NOT NULL DEFAULT 'ai',
    "playCount" INTEGER NOT NULL DEFAULT 0,
    "avgRating" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyPackArticle" (
    "packId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StudyPackArticle_pkey" PRIMARY KEY ("packId","articleId")
);

-- CreateTable
CREATE TABLE "StudySession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL DEFAULT 'medium',
    "articlesCompleted" INTEGER NOT NULL DEFAULT 0,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "avgAccuracy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastPlayedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "StudySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyResult" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "correctCount" INTEGER NOT NULL,
    "wrongCount" INTEGER NOT NULL,
    "timeTaken" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackRating" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudyPackArticle_packId_order_idx" ON "StudyPackArticle"("packId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "PackRating_packId_userId_key" ON "PackRating"("packId", "userId");

-- AddForeignKey
ALTER TABLE "StudyPack" ADD CONSTRAINT "StudyPack_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyPackArticle" ADD CONSTRAINT "StudyPackArticle_packId_fkey" FOREIGN KEY ("packId") REFERENCES "StudyPack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyPackArticle" ADD CONSTRAINT "StudyPackArticle_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "FactCheckArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_packId_fkey" FOREIGN KEY ("packId") REFERENCES "StudyPack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyResult" ADD CONSTRAINT "StudyResult_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StudySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackRating" ADD CONSTRAINT "PackRating_packId_fkey" FOREIGN KEY ("packId") REFERENCES "StudyPack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackRating" ADD CONSTRAINT "PackRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
