```javascript
const guest {
    far {
        tables-booking {
            reservation{
                restaurantId
                reservationCode
                dishes-booking
                ...table
            }
        }
        dishes-booking {
            order{
                reservationCode
                restaurantId
                orderCode
                status
                tableCode
                orderItem{
                    status
                }
                ...

            }
        }
    }
    restaurant {
        dishes {
            order {
               restaurantId
               orderCode
               status
               orderItem {
                    status
                }
                ...
            }
        }

    }

}
```
