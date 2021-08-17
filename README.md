# PTV API Helper
## A NodeJS library for the Victorian Public Transport Timetable API.
Created as part of a bootcamp project this isn't intended as a 1:1 wrapper, instead covering and simplifying most of the common actions that a timetable app would need such as searching for stops, getting departures and disruptions etc.

### Usage
You'll need to register for an API key before you can start making requests. You can find out about how to do this (and learn more about the API itself) [here](https://www.ptv.vic.gov.au/footer/data-and-reporting/datasets/ptv-timetable-api/).

Install the module

```npm install ptv-api-helper```\
or\
```yarn add ptv-api-helper```

#### Example (Finds all trains and busses in the suburb of Batman)
```
const ptvClient = require('ptv-api-helper')(1000 (your dev id), 'your api key here');

ptvClient.searchForStopByLocationAsync('Batman', [0, 2])
.then(stops => stops.forEach(s => console.log(s.name)))
.catch(ex => console.log(ex));
```

### What can I do?
TODO: Full documentation.

Here is an overview of the methods currently available:

```getAllTransportTypesAsync()``` - Gets a list of all modes of transport supported by the API. 

```getDetailedStopInfoAsync(stopId, transportType, options = { includeDisruptions: true })``` - Get information on a stop's ammenties and accessability facilities, and optionally any drisruptions. _You should generally take any ammentity/accessability info for non-premium stations with a grain of salt. For example, many train stops list having a toilet, which may be technically true, but is either permamently locked or only accessable during peak hours._

```getDeparturesForAStopAsync(stopId, transportTypeId, options = { startDateUTC: '2021-08-17T14:48:52.356Z', directionId: 15, maxResults: 10, includeDisruptions: true, includeDirections: true, preSortDepartures: true })``` - Gets departures for a stop and optionally overviews for lines (lines) and disruptions. By default includes all lines in all directions. Note that maxResults is the number of departures *per line*. Includes live arrival times for services that support it.

```getDeparturesForARunAsync(runRef,transportType)``` - Gets departures for all stops on a particular service, ordered by first to last. Includes live arrival times for services that support it.

```calculateFareAsync(zoneStart, zoneEnd)``` - Gets myki fare prices for traveling between two zones.

```getStopsOnALineAsync(lineId, transportType, directionId)``` - Gets all stops on a line in a particular direction, ordered from first stop to destination.

```searchForStopByLocationAsync(latitude, longitude, transportFilters = [0,1,2,3,4], maxDistance = 1000)``` - Gets all stops within a location.

```searchForStopBySuburbAsync(suburb, transportFilters = [0,1,2,3,4])``` - Gets all stops within a suburb.

```getStopsOnALineAsync(lineId, transportType, directionId)``` - Gets all stops for a line in a particular direction.

```getDirectionsForLineAsync(lineId)``` - Gets line directions for a line (ie. Flinders Street to Weribee, Brunswick East to St Kilda Beach etc.)

```getFutureDisruptionsForStopAsync(stopId, transportType)``` - Gets future disruptions for a stop.

```getCurrentDisruptionsForStopAsync(stopId, transportType)``` - Gets current disruptions for a stop.
