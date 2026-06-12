from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field


UEBA_SCHEMA_VERSION = "1"


class UebaFeatureReason(BaseModel):
    feature: str
    value: float
    baseline: float
    direction: Literal["high", "low"]
    contribution: float = Field(ge=0.0, le=1.0)


class UebaDetectorScores(BaseModel):
    isolationForest: float = Field(ge=0.0, le=1.0)
    ecod: float = Field(ge=0.0, le=1.0)
    copod: float = Field(ge=0.0, le=1.0)


class UebaScoreRequest(BaseModel):
    schemaVersion: Literal["1"]
    projectId: str
    sessionId: str
    user: str
    ip: str
    service: str
    eventIds: List[str]
    features: Dict[str, float]


class UebaScoreResponse(BaseModel):
    schemaVersion: Literal["1"]
    modelVersion: str
    behaviorScore: float = Field(ge=0.0, le=100.0)
    anomalyScore: float = Field(ge=0.0, le=1.0)
    isAnomaly: bool
    detectorScores: UebaDetectorScores
    topReasons: List[UebaFeatureReason]


class UebaSessionScore(UebaScoreResponse):
    sessionId: str
    user: str
    ip: str
    service: str
    eventIds: List[str]


class UebaScoreSummary(BaseModel):
    schemaVersion: Literal["1"]
    modelVersion: str
    scoredAt: str
    baselineMaturity: Literal["bootstrap", "tenant"]
    behaviorScore: float = Field(ge=0.0, le=100.0)
    selectedSessionId: Optional[str] = None
    sessionScores: List[UebaSessionScore]
    mlUnavailable: Optional[bool] = None
    error: Optional[str] = None
