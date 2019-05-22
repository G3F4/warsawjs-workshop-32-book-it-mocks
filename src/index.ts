const cors = require('cors');
const express = require('express');
const morgan = require('morgan');
const lodash = require('lodash');
const faker = require('faker/locale/pl');

interface Accommodation {
  id: string;
  title: string;
  images: string[];
  cover: {
    url: string;
    tag: string;
  };
  location: {
    address: string;
    centre: number;
  };
  rating: {
    average: number;
    reviews: number;
  };
  insights: Array<{
    text: string;
    tag: string;
    highlights: boolean;
  }>;
  demand: string;
  room: string;
  price: {
    amount: number;
    currency: string;
    breakfast: boolean;
  };
  type: string;
  description: string;
  facilities: string[];
}
interface AccommodationDetails {
  id: string;
  title: string;
  images: string[];
  address: string;
  rating: {
    average: string;
    reviews: string;
  };
  price: {
    amount: string;
    currency: string;
    breakfast: boolean;
  };
  type: string;
  description: string;
  facilities: string[];
}
interface AccommodationListItem {
  id: string;
  title: string;
  cover: {
    url: string;
    tag: string;
  };
  location: {
    address: string;
    centre: string;
  };
  rating: {
    average: string;
    reviews: string;
  };
  insights: Array<{
    text: string;
    tag: string;
    highlights: boolean;
  }>;
  demand: string;
  room: string;
  price: {
    amount: string;
    currency: string;
    breakfast: boolean;
  };
}
interface ListFilters {
  title: string;
  centre: number;
  minPrice: number;
  minAvgRating: number;
  minReviewsCount: number;
}

interface GetListQuery {
  search: string;
  centre: string;
  minPrice: string;
  minAvgRating: string;
  minReviewsCount: string;
  sorting: SORTING;
}
interface GetDetailsQuery {
  id: string;
}
interface GetSuggestionsQuery {
  search: string;
}
interface GetListResponse {
  list: AccommodationListItem[];
}
interface Suggestion {
  label: string;
}
interface GetSuggestionsResponse {
  suggestions: Suggestion[];
}
interface GetDetailsResponse {
  data: AccommodationDetails;
}

const app = express();

const ACCOMMODATIONS_COUNT = 100;

enum SORTING {
  MAX_AVG_RATING = 'MAX_AVG_RATING',
  MAX_REVIEWS = 'MAX_REVIEWS',
  MIN_PRICE = 'MIN_PRICE',
  MAX_PRICE = 'MAX_PRICE',
}
const ACCOMMODATION_TYPES = ['HOTEL', 'PRIVATE', 'HOSTEL', 'HOUSE'];
const FACILITIES = [
  'NON_SMOKING',
  'DISABLED_GUESTS_SERVICE',
  'PARKING',
  'FREE_WIFI',
  'PETS_ALLOWED',
  'BREAKFAST',
];
const DEMAND = ['LOW', 'MEDIUM', 'HIGH'];
const ROOM = ['DOUBLE', 'SINGLE', 'FAMILY'];

const generateAccommodation = (): Accommodation => {
  const images = Array.from({ length: faker.random.number({ min: 3, max: 30 })})
    .map((): string => faker.image.city());

  return {
    images,
    id: faker.random.uuid(),
    title: faker.commerce.productName(),
    cover: {
      url: images[0],
      tag: faker.lorem.word(),
    },
    location: {
      address: `${faker.address.streetAddress()}, ${faker.address.zipCode()}, ${faker.address.country()}`,
      centre: faker.random.number({ min: 10, max: 100 }) / 10,
    },
    rating: {
      average: (faker.random.number({ min: 10, max: 100 }) / 10),
      reviews: faker.random.number({ min: 0, max: 10000 }),
    },
    insights: Array.from({ length: faker.random.number({ min: 0, max: 25 }) }).map(() => ({
      text: faker.lorem.sentence(),
      tag: lodash.sample([faker.lorem.words(), null]),
      highlights: faker.random.boolean(),
    })),
    demand: lodash.sample(DEMAND),
    room: lodash.sample(ROOM),
    price: {
      amount: (faker.random.number({ min: 10, max: 1000 }) * 10),
      currency: faker.finance.currencySymbol(),
      breakfast: faker.random.boolean(),
    },
    type: lodash.sample(ACCOMMODATION_TYPES),
    description: faker.lorem.paragraphs(),
    facilities: lodash.sampleSize(FACILITIES, faker.random.number({ min: 0, max: FACILITIES.length })),
  };
};

class State {
  private accommodations: Accommodation[] = Array.from({ length: ACCOMMODATIONS_COUNT }).map(generateAccommodation);

  public findAccommodations(filters: ListFilters): Accommodation[] {
    console.log(['findAccommodations'], filters)
    return this.accommodations.filter(({ title, location: { centre }, price, rating }) => (
      title.toLowerCase().includes(filters.title.toLowerCase()) &&
      centre < filters.centre &&
      price.amount > filters.minPrice &&
      rating.reviews > filters.minReviewsCount &&
      rating.average > filters.minAvgRating
    ));
  }

  public findAccommodation(id: string): Accommodation {
    return this.accommodations.find((accommodation => accommodation.id === id));
  }

  public findAccommodationsByTitle(title: string): Accommodation[] {
    return this.accommodations.filter((accommodation => accommodation.title.includes(title)));
  }
}

const mapAccommodationToListItem = (acc: Accommodation): AccommodationListItem => ({
  id: acc.id,
  cover: acc.cover,
  demand: acc.demand,
  insights: acc.insights,
  location: {
    address: acc.location.address,
    centre: `${acc.location.centre} km`,
  },
  price: {
    amount: acc.price.amount.toString(),
    breakfast: acc.price.breakfast,
    currency: acc.price.currency.toString(),
  },
  rating: {
    average: acc.rating.average.toString(),
    reviews: acc.rating.reviews.toString(),
  },
  room: acc.room,
  title: acc.title,
});
const mapAccommodationToSuggestion = (acc: Accommodation): Suggestion => ({
  label: acc.title,
});
const mapDetails = (acc: Accommodation): AccommodationDetails => ({
  id: acc.id,
  price: {
    amount: acc.price.amount.toString(),
    breakfast: acc.price.breakfast,
    currency: acc.price.currency.toString(),
  },
  rating: {
    average: acc.rating.average.toString(),
    reviews: acc.rating.reviews.toString(),
  },
  title: acc.title,
  address: acc.location.address,
  description: acc.description,
  facilities: acc.facilities,
  images: acc.images,
  type: acc.type,
});
const mapListQueryToFilters = (query: GetListQuery): ListFilters => ({
  title: query.search || '',
  centre: parseInt(query.centre, 10) || Number.MAX_SAFE_INTEGER,
  minPrice: parseInt(query.minPrice, 10) || 0,
  minAvgRating: parseInt(query.minAvgRating, 10) || 0,
  minReviewsCount: parseInt(query.minReviewsCount, 10) || 0,
});

class Api {
  private dataProvider: State = new State();

  public getDetails(query: GetDetailsQuery): GetDetailsResponse {
    console.log(['getDetails.query'], query)
    const accommodation = this.dataProvider.findAccommodation(query.id);
    console.log(['getDetails.accommodation'], accommodation)
    const data = mapDetails(accommodation);

    return { data };
  }

  public getList(query: GetListQuery): GetListResponse {
    console.log(['getList.query'], query)
    const filters = mapListQueryToFilters(query);
    console.log(['getList.query.sorting === SORTING.MAX_AVG_RATING'], query.sorting === SORTING.MAX_AVG_RATING)
    const list = [...this.dataProvider.findAccommodations(filters)].sort((a, b) => {
      if (query.sorting === SORTING.MAX_AVG_RATING) {
        return b.rating.average - a.rating.average;
      }
      else if (query.sorting === SORTING.MIN_PRICE) {
        return a.price.amount - b.price.amount;
      }
      else if (query.sorting === SORTING.MAX_PRICE) {
        return b.price.amount - a.price.amount;
      }
      else if (query.sorting === SORTING.MAX_REVIEWS) {
        return b.rating.reviews - a.rating.reviews;
      }

      return 0;
    }).map(mapAccommodationToListItem);

    return { list };
  }

  public getSuggestions(query: GetSuggestionsQuery): GetSuggestionsResponse {
    console.log(['getList.query'], query)
    const suggestions = this.dataProvider.findAccommodationsByTitle(query.search).map(mapAccommodationToSuggestion);

    return { suggestions };
  }
}

const api = new Api();

app.use(cors());
app.use(morgan('combined'));

app.get('/list', (req, res) => {
  res.send(api.getList(req.query));
});

app.get('/suggestions', (req, res) => {
  res.send(api.getSuggestions(req.query));
});

app.get('/details', (req, res) => {
  res.send(api.getDetails(req.query));
});

app.set('port', process.env.PORT || 5000);

app.listen(app.get('port'), () => {
  console.info( `express app running on port: ${app.get('port')}`);
});
