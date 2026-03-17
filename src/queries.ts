/**
 * GraphQL query strings sent to the RateMyProfessors API.
 *
 * Each constant matches an operation the RMP frontend uses. Variable names
 * and fragment names are kept identical so the server accepts them.
 */

/** Paginated professor ratings (RMP's RatingsListQuery). */
export const RATINGS_LIST_QUERY = `
query RatingsListQuery($count: Int!, $id: ID!, $courseFilter: String, $cursor: String) {
  node(id: $id) {
    __typename
    ... on Teacher {
      ...RatingsList_teacher_4pguUW
      id
    }
  }
}
fragment RatingsList_teacher_4pguUW on Teacher {
  id
  legacyId
  lastName
  numRatings
  school {
    id
    legacyId
    name
    city
    state
    avgRating
    numRatings
  }
  ratings(first: $count, after: $cursor, courseFilter: $courseFilter) {
    edges {
      cursor
      node {
        id
        __typename
        comment
        helpfulRating
        clarityRating
        difficultyRating
        ratingTags
        date
        class
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
`;

/** Paginated school ratings (RMP's SchoolRatingsListQuery). */
export const SCHOOL_RATINGS_LIST_QUERY = `
query SchoolRatingsListQuery($count: Int!, $id: ID!, $cursor: String) {
  node(id: $id) {
    ... on School {
      id
      name
      city
      state
      country
      ratings(first: $count, after: $cursor) {
        edges {
          cursor
          node {
            id
            comment
            date
            reputationRating
            locationRating
            safetyRating
            socialRating
            opportunitiesRating
            happinessRating
            facilitiesRating
            internetRating
            foodRating
            clubsRating
            thumbsUpTotal
            thumbsDownTotal
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
}
`;

/** School search with pagination and result count (RMP's SchoolSearchResultsPageQuery). */
export const SCHOOL_SEARCH_RESULTS_QUERY = `
query SchoolSearchResultsPageQuery($query: SchoolSearchQuery!, $count: Int!, $cursor: String) {
  search: newSearch {
    schools(query: $query, first: $count, after: $cursor) {
      edges {
        cursor
        node {
          id
          legacyId
          name
          city
          state
          numRatings
          avgRating
          avgRatingRounded
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      resultCount
    }
  }
}
`;

/** Professor search with pagination and result count (RMP's TeacherSearchResultsPageQuery). */
export const TEACHER_SEARCH_RESULTS_QUERY = `
query TeacherSearchResultsPageQuery($query: TeacherSearchQuery!, $count: Int!, $cursor: String) {
  search: newSearch {
    teachers(query: $query, first: $count, after: $cursor) {
      edges {
        cursor
        node {
          id
          legacyId
          firstName
          lastName
          avgRating
          numRatings
          wouldTakeAgainPercent
          avgDifficulty
          department
          school {
            id
            legacyId
            name
            city
            state
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      resultCount
    }
  }
}
`;

/** Fetch a single teacher by Relay global ID. */
export const GET_TEACHER_QUERY = `
query GetTeacherQuery($id: ID!) {
  node(id: $id) {
    ... on Teacher {
      id
      legacyId
      firstName
      lastName
      department
      avgRating
      avgDifficulty
      numRatings
      wouldTakeAgainPercent
      school {
        id
        legacyId
        name
        city
        state
      }
    }
  }
}
`;

/** Fetch a single school by Relay global ID, including summary category ratings. */
export const GET_SCHOOL_QUERY = `
query GetSchoolQuery($id: ID!) {
  node(id: $id) {
    ... on School {
      id
      legacyId
      name
      city
      state
      country
      numRatings
      avgRatingRounded
      summary {
        campusCondition
        campusLocation
        careerOpportunities
        clubAndEventActivities
        foodQuality
        internetSpeed
        schoolReputation
        schoolSafety
        schoolSatisfaction
        socialActivities
      }
    }
  }
}
`;
