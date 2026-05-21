# 네이버 뉴스 옴부즈만 정정·고침 비교기

네이버 뉴스 옴부즈만 페이지의 정정·고침 기사와 원본 기사를 나란히 보여주고 diff를 표시하는 웹앱.

## 배경

네이버 뉴스는 두 종류의 옴부즈만 페이지를 운영한다.

- **고침·바로잡습니다**: https://news.naver.com/ombudsman/errorArticleList
- **정정·반론·추후 보도**: https://news.naver.com/ombudsman/revisionArticleList

문제: 정정문만 보면 "어떤 원래 기사를 바로잡는 건지" 알기 어렵다. 원본 기사로의 직접 링크가 제공되지 않는 경우가 많고, 본문 안에 "본보 ○월 ○일자 …" 같은 단서만 남겨두는 경우가 많다.

**목표**: 정정문과 원본 기사 본문을 나란히 보여주고, 둘 다 본문이 있으면 문장/단어 단위 diff까지 표시한다.

## MVP 범위

| 항목 | 결정 |
|------|------|
| 데이터 규모 | 최근 정정·고침 사례 30~50건 |
| 수집 방식 | 수동·반자동. 자동 크롤러 없음 |
| 데이터 저장 | `data/cases.json` 파일 하나. DB 없음 |
| 원본 미발견 시 | 후보 여러 개 제시 → 독자가 직접 선택 |

**비목표**: 자동 매칭 정확도, 대량 처리, 인증, 사용자 계정, 실시간 업데이트

## 기술 스택

- **프레임워크**: Next.js (App Router) + TypeScript
- **스타일**: Tailwind CSS
- **diff**: [diff](https://www.npmjs.com/package/diff) (jsdiff)
- **데이터**: `data/cases.json` (정적 파일)
- **배포**: Vercel 정적 호스팅

## 화면 구성

```
1. 목록 페이지 (/)
   └── 정정 사례 카드 그리드
       언론사 · 날짜 · 유형(배지) · 제목 · "원본 후보 N개"

2. 사례 상세 (/case/[id])
   ├── 정정문 전문
   ├── original_clue 강조 표시
   └── 원본 후보 카드들 (선택 → 비교 뷰로 이동)

3. 비교 뷰 (/case/[id]/compare?candidate=0)
   ├── 데스크톱: 좌(원본) / 우(정정문) 2단
   ├── 본문 있으면 문장·단어 단위 diff 하이라이트
   └── 모바일: 탭 전환 (원본 / 정정문)
```

## 데이터 모델

`data/cases.json` 배열. 각 항목 구조:

```json
{
  "id": "2026-05-12-chosun-001",
  "correction": {
    "publisher": "조선일보",
    "type": "정정보도",
    "date": "2026-05-12",
    "url": "https://n.news.naver.com/...",
    "title": "...",
    "body": "..."
  },
  "original_candidates": [
    {
      "url": "https://n.news.naver.com/...",
      "title": "...",
      "date": "2026-05-08",
      "snippet": "...",
      "confidence": "high"
    }
  ],
  "original_clue": "본보 5월 8일자 A3면 '...' 제목의 기사"
}
```

### 필드 설명

| 필드 | 설명 |
|------|------|
| `id` | `YYYY-MM-DD-언론사슬러그-순번` 형식 |
| `correction.type` | `"고침"` `"바로잡습니다"` `"정정보도"` `"반론보도"` `"추후보도"` |
| `original_candidates` | 0~5개. 0개도 정상 케이스 (원본 미발견) |
| `original_clue` | 정정문 본문에서 추출한 원본 식별 단서 |
| `confidence` | `"high"` `"medium"` `"low"` |

## 데이터 입력 방법 (반자동)

1. 네이버 뉴스 옴부즈만 페이지에서 정정 기사 URL 확인
2. 정정문 제목·본문·날짜·언론사 복사
3. 본문에서 `original_clue` 추출 ("본보 ○월 ○일자 …" 패턴)
4. 네이버 뉴스 검색으로 원본 기사 후보 탐색
5. `data/cases.json`에 새 항목 추가

## 주의사항

- **저작권**: 본문 전체 표시는 위험. 발췌(`snippet`) + 원문 링크 원칙.
  본문(`body`)은 정정문(옴부즈만 공시)에 한해 전문 표시.
- **네이버 구조 변경**: 수동 운영이므로 크게 영향 없음.

## 프로젝트 구조

```
ombudsman-diff/
├── app/                    # Next.js App Router
│   ├── page.tsx            # 목록 페이지
│   ├── case/[id]/
│   │   ├── page.tsx        # 사례 상세 (후보 선택)
│   │   └── compare/
│   │       └── page.tsx    # 비교 뷰
│   └── layout.tsx
├── data/
│   └── cases.json          # 모든 사례 데이터
├── types/
│   └── case.ts             # TypeScript 타입 정의
└── components/             # (다음 세션에서 추가)
```

## 개발 시작

```bash
npm run dev
```

http://localhost:3000 에서 확인.
