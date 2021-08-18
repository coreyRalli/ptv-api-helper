const crypto = require('crypto');
const fetch = require('node-fetch');

function ptvClient(devId, apiKey) {
    const baseUrl = 'https://timetableapi.ptv.vic.gov.au';
    const APIPaths = {
        departures: '/v3/departures/',
        lineStops: '/v3/stops/route/',
        stops: '/v3/stops/',
        transportTypes: '/v3/route_types',
        directions: '/v3/directions/route/',
        patterns: '/v3/pattern/run/',
        stopDisruptions: '/v3/disruptions/stop/',
        fares: '/v3/fare_estimate/min_zone/',
        search: '/v3/search/',
        stopsByLocation: '/v3/stops/location/',
    }

    async function makeAPIRequestAsync(method) {
        const separator = (method.includes('?')) ? '&' : '?';

        const query = `${method}${separator}devid=${devId}`;

        const signature = crypto.createHmac('sha1', apiKey).update(query).digest('hex');

        const requestUrl = `${baseUrl}${query}&signature=${signature}`;

        const response = await fetch(requestUrl);

        if (response.status !== 200 && response.status !== 400 && response.status !== 403)
            throw new Error(`Response returned code ${response.status}. Check request method or internet connection`);

        const json = await response.json();

        if (response.status == 403)
            throw new Error(`Authentication error: "${json.message}"`);

        if (response.status == 400)
            throw new Error(`Invalid request: "${json.message}"`);

        return json;
    }

    async function calculateFareAsync(zoneStart, zoneEnd) {
        const method = `${APIPaths.fares}${zoneStart}/max_zone/${zoneEnd}`;

        const response = await makeAPIRequestAsync(method);

        return {
            journeyStartsInEarlyBird: response.FareEstimateResult.IsEarlyBird,
            weekendRateActivated: response.FareEstimateResult.IsThisWeekendJourney,
            fullPrice: parsePrices(response.FareEstimateResult.PassengerFares[0]),
            concession: parsePrices(response.FareEstimateResult.PassengerFares[1]),
            senior: parsePrices(response.FareEstimateResult.PassengerFares[2])
        }
    }

    async function getDetailedStopInfoAsync(stopId, transportType, options = {}) {
        const method = `${APIPaths.stops}${stopId}/route_type/${transportType}?stop_location=true&stop_ticket=true&stop_amenities=true&stop_accessibility=true&stop_staffing=true&stop_disruptions=true`;

        const stopResponse = await makeAPIRequestAsync(method);
        const stop = stopResponse.stop;

        return {
            stop: parseDetailedStop(stop),
            disruptions: (options.includeDisruptions) ? Object.keys(stopResponse.disruptions).map(dis => parseDisruption(stopResponse.disruptions[dis])) : []
        }
    }

    async function getAllTransportTypesAsync() {
        const routeTypes = await makeAPIRequestAsync(APIPaths.transportTypes);
        return routeTypes.route_types.map(tt => parseTransportType(tt));
    }

    async function getDeparturesForStopAsync(stopId, transportTypeId, options = {}) {
        const expandString = `expand=Route&expand=Stop&expand=Direction&${options.includeDisruptions ? 'expand=Disruptions&' : ''}`
        const dateString = (typeof options.startDateUTC !== 'undefined') ? encodeURIComponent((encodeURIComponent(options.startDateUTC))) : encodeURIComponent(new Date().toISOString());
        const directionIdString = (typeof options.directionId !== 'undefined') ? `direction_id=${options.directionId}&` : '';

        const maxResultsString = (typeof options.maxResults !== 'undefined') ? `max_results=${options.maxResults}&` : `max_results=10&`;

        const response =
            await makeAPIRequestAsync(`${APIPaths.departures}route_type/${transportTypeId}/stop/${stopId}?${maxResultsString}${directionIdString}${expandString}date_utc=${dateString}`);

        if (options.preSortDepartures) {
            response.departures.sort((a, b) => sortDepartures(a, b));
        }

        return {
            departureLength: response.departures.length,
            departures: response.departures.map(dp => parseDeparture(dp)),
            directions: (options.includeDirections) ? Object.keys(response.directions).map(dir => parseDirection(response.directions[dir])) : [],
            disruptions: (options.includeDisruptions) ? Object.keys(response.disruptions).map(dis => parseDisruption(response.disruptions[dis])) : []
        }
    }

    async function getDirectionsForLineAsync(lineId) {
        const method = `${APIPaths.directions}${lineId}`;

        const directionsResponse = await makeAPIRequestAsync(method);
        return directionsResponse.directions.map(dir => parseDirection(dir));
    }

    async function getStopsOnALineAsync(lineId, transportType, directionId) {
        const method = `${APIPaths.lineStops}${lineId}/route_type/${transportType}?direction_id=${directionId}&stop_disruptions=false`;

        const response = await makeAPIRequestAsync(method);

        const stops = response.stops.map(s => ({ id: s.stop_id, name: s.stop_name, stopNumber: s.stop_sequence }));
        stops.sort((a, b) => a.stopNumber - b.stopNumber);

        return stops;
    }

    async function getDeparturesForARunAsync(runRef, transportType) {
        const method = `${APIPaths.patterns}${runRef}/route_type/${transportType}?expand=Stop`;

        const response = await makeAPIRequestAsync(method);

        const departures = response.departures.map(stop => parseRunStop(stop, response.stops));

        departures.sort((a, b) => a.stopNumber - b.stopNumber)

        return {
            departures: departures
        }
    }

    async function searchForStopBySuburbAsync(suburb, transportFilters) {
        const transportTypeString = transportFilters.map(tt => `route_types=${tt}`).join('&')
        const method = `${APIPaths.search}${encodeURIComponent(suburb)}?${transportTypeString}&include_outlets=false`;

        const searchResponse = await makeAPIRequestAsync(method);
        return parseStopSearchResults(searchResponse);
    }

    async function searchForStopByLocationAsync(latitude, longitude, transportFilters, maxDistance = 1000) {
        const transportTypeString = transportFilters.map(tt => `route_types=${tt}`).join('&')
        const locationString = `${latitude},${longitude}`;
        const method = `${APIPaths.stopsByLocation}${locationString}${(transportFilters.length > 0) ? `?${transportTypeString}` : ""}&max_distance=${maxDistance}`;

        const searchResponse = await makeAPIRequestAsync(method);
        return parseStopSearchResults(searchResponse);
    }

    async function getCurrentDisruptionsForStopAsync(stopId, transportType) {
        const method = `${APIPaths.stopDisruptions}${stopId}?disruption_status=current`;

        const disruptionResponse = await makeAPIRequestAsync(method);
        return parseDisruptions(disruptionResponse, transportType);
    }

    async function getFutureDisruptionsForStopAsync(stopId, transportType) {
        const method = `${APIPaths.stopDisruptions}${stopId}?disruption_status=planned`;

        const disruptionResponse = await makeAPIRequestAsync(method);

        return parseDisruptions(disruptionResponse, transportType);
    }

    function parseDetailedStop(stop) {
        return {
            id: stop.stop_id,
            operatingHours: (stop.operating_hours !== "N") ? stop.operating_hours : "No Operating Hours",
            name: stop.stop_name,
            stopLong: stop.stop_location.gps.longitude,
            stopLat: stop.stop_location.gps.latitude,
            stationStaffing: stop.station_type,
            stationStaffingDescription: stop.station_description,
            zones: stop.stop_ticket.ticket_zones,
            hasTicketMachine: stop.stop_ticket.ticket_machine,
            inFreeTramZone: stop.stop_ticket.is_free_fare_zone,
            isReservationOnly: stop.stop_ticket.vline_reservation,
            hasToilet: stop.stop_amenities.toilet,
            hasLift: stop.stop_accessibility.lift,
            seatingType: stop.stop_amenities.seat_type,
            sheltered: stop.stop_amenities.sheltered_waiting_area,
            indoorWaitingArea: stop.stop_amenities.indoor_waiting_area,
            parkingSpots: (isNaN(parseInt(stop.stop_amenities.car_parking))) ? -1 : parseInt(stop.stop_amenities.car_parking)
        }
    }

    function sortDepartures(a, b) {
        var d1 = new Date(a.timetabledArrivalTimeUTC);
        var d2 = new Date(b.timetabledArrivalTimeUTC);

        return d1 < d2;
    }

    function parseTransportType(transportType) {
        return ({
            name: transportType.route_type_name,
            id: transportType.route_type
        });
    }

    function parseRouteResults(results) {
        return results.map(r => ({
            name: r.route_name,
            id: r.route_id,
            transportType: r.route_type
        }));
    }

    function parseRunStop(run, stops) {
        return ({
            name: stops[run.stop_id]?.stop_name,
            transportType: stops[run.stop_id]?.route_type,
            zones: stops[run.stop_id]?.stop_ticket?.ticket_zones,
            stopId: run.stop_id,
            lineId: run.route_id,
            id: run.run_id,
            runRef: run.run_ref,
            liveDepatureTime: run.estimated_departure_utc,
            timetabledDepatureTime: run.scheduled_departure_utc,
            stopNumber: run.departure_sequence,
            directionId: run.direction_id
        })
    }

    function parseStopSearchResults(results) {
        return results.stops.map(s => ({
            name: s.stop_name,
            distance: s.stop_distance,
            id: s.stop_id,
            suburb: s.stop_suburb,
            transportType: s.route_type,
            stopLat: s.stop_latitude,
            stopLong: s.stop_longitude,
            routes: parseRouteResults(s.routes)
        }));
    }

    function parseDeparture(departure) {
        return {
            id: departure.direction_id,
            lineId: departure.route_id,
            directionId: departure.direction_id,
            disruptions: departure.disruption_ids,
            stopId: departure.stop_id,
            runRef: departure.run_ref,
            runId: departure.run_id,
            platform: departure.platform_number,
            liveArrivalTimeUTC: departure.estimated_departure_utc,
            timetabledArrivalTimeUTC: departure.scheduled_departure_utc
        }
    }

    function parseDisruption(disruption) {
        return {
            id: disruption.disruption_id,
            title: disruption.title,
            url: disruption.url,
            description: disruption.description,
            status: disruption.disruption_status,
            type: disruption.disruption_type,
            startDate: disruption.from_date,
            endDate: disruption.to_date,
            updated: disruption.last_updated
        }
    }

    function parseDirection(direction) {
        return {
            name: direction.direction_name,
            id: direction.direction_id,
            description: direction.route_direction_description,
            lineId: direction.route_id,
            transportType: direction.route_type
        }
    }

    function parsePrices(priceCategory) {
        return {
            twoHourPeak: priceCategory.Fare2HourPeak,
            twoHourOffPeak: priceCategory.Fare2HourPeak,
            daily: priceCategory.FareDailyPeak,
            sevenDayPass: priceCategory.Pass7Days,
            weekendAndHolidayCap: priceCategory.WeekendCap,
            daily28to69Price: priceCategory.Pass28To69DayPerDay,
            daily70plusPrice: priceCategory.Pass70PlusDayPerDay
        }
    }

    function parseSingleDisruption(disruptions) {
        return disruptions.map(dis => ({
            id: dis.disruption_id,
            title: dis.title,
            url: dis.url,
            description: dis.description,
            status: dis.disruption_status,
            type: dis.disruption_type,
            startDate: dis.from_date,
            endDate: dis.to_date,
            updated: dis.last_updated
        }));
    }

    function parseDisruptions(response, stopType) {
        const generalDisruptions = parseSingleDisruption(response.disruptions.general);

        let transportDisruptions = [];

        switch (stopType) {
            case 0:
                transportDisruptions = parseSingleDisruption(response.disruptions.metro_train);
                break;
            case 1:
                transportDisruptions = parseSingleDisruption(response.disruptions.metro_tram);
                break;
            case 2:
                transportDisruptions = [...parseSingleDisruption(response.disruptions.metro_bus), ...parseSingleDisruption(response.disruptions.regional_bus)];
                break;
            case 3:
                transportDisruptions = [...parseSingleDisruption(response.disruptions.regional_bus), ...parseSingleDisruption(response.disruptions.regional_coach), ...parseSingleDisruption(response.disruptions.regional_train)]
                break;
        }

        return {
            generalDisruptions,
            transportDisruptions
        }
    }

    return {
        calculateFareAsync,
        getDetailedStopInfoAsync,
        getAllTransportTypesAsync,
        getDeparturesForStopAsync,
        getDeparturesForARunAsync,
        getDirectionsForLineAsync,
        getStopsOnALineAsync,
        searchForStopByLocationAsync,
        searchForStopBySuburbAsync,
        getFutureDisruptionsForStopAsync,
        getCurrentDisruptionsForStopAsync
    }
}

module.exports = ptvClient;