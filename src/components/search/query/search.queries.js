import { gql } from "@apollo/client";

export const SEARCH_SUGGESTIONS = gql`
  query SearchSuggestions($query: String!, $limitPerType: Int) {
    searchSuggestions(query: $query, limitPerType: $limitPerType) {
      restaurants {
        id
        name
        shortAddress
        fullAddress
        avgRating
        cuisineType
        phone
        lat
        lng
      }
      menuItems {
        id
        name
        restaurantId
        restaurantName
        timeSlot
        thumbImage
        basePrice
        categoryName
        servingLabel
        cookingMethods
      }
      chefs {
        id
        fullName
        positionTitle
        avatarUrl
        restaurantId
        restaurantName
        contactPhone
      }
      owners {
        id
        fullName
        phone
        email
        managedRestaurantCount
      }
      locations {
        label
        ward
        district
        city
        country
        postalCode
        lat
        lng
      }
    }
  }
`;

export const SEARCH = gql`
  query Search(
    $query: String!
    $filter: SearchFilterInput
    $limit: Int
    $offset: Int
  ) {
    search(query: $query, filter: $filter, limit: $limit, offset: $offset) {
      totalCount
      items {
        type
        score
        timeSlot
        categoryName
        servingLabel
        cookingMethods

        restaurant {
          id
          name
          coverImage
          avatar
          avgRating
          cuisineType
          phone
          address {
            district
            city
          }
        }

        menuItem {
          id
          name
          basePrice
          thumbImage
        }

        chef {
          id
          fullName
          positionTitle
          avatarUrl
          restaurantId
          restaurantName
          contactPhone
        }

        owner {
          id
          fullName
          email
          phone
        }

        locationLabel
        locationCity
        locationDistrict
      }
    }
  }
`;
