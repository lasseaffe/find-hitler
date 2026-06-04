-- CreateIndex on StudySession
CREATE INDEX "StudySession_userId_idx" ON "public"."StudySession"("userId");

-- CreateIndex on StudyResult
CREATE INDEX "StudyResult_sessionId_idx" ON "public"."StudyResult"("sessionId");

-- CreateUnique on StudyResult
CREATE UNIQUE INDEX "StudyResult_sessionId_articleId_key" ON "public"."StudyResult"("sessionId", "articleId");

-- CreateIndex on StudyPack
CREATE INDEX "StudyPack_status_grade_subject_idx" ON "public"."StudyPack"("status", "grade", "subject");

-- CreateIndex on PackRating
CREATE INDEX "PackRating_userId_idx" ON "public"."PackRating"("userId");
