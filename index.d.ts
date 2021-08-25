declare module 'ptv-api-helper' {
    interface DetailedStopOptions {
        includeDisruptions?: boolean;
        includeRoutes?: boolean;
    }

    interface StopDepartureOptions {
        includeDisruptions?: boolean;
        includeDirections?: boolean;
        startDateUTC?: string;
        directionId?: number;
        maxResults?: number;
        preSortDepartures?: boolean;
    }

    interface TicketTypes {
        twoHourPeak: number,
        twoHourOffPeak: number,
        daily: number,
        sevenDayPass: number,
        weekendAndHolidayCap: number,
        daily28to69Price: number,
        daily70plusPrice: number
    }

    interface TicketPrices {
        journeyStartsInEarlyBird: boolean;
        weekendRateActivated: boolean;
        fullPrice: TicketTypes;
        concession: TicketTypes;
        senior: TicketTypes;
    }

    interface DetailedStop {
        stop: DetailedStopInfo;
        disruptions?: Disruption[];
    }

    interface DetailedStopInfo {
        id: number,
        operatingHours: string;
        name: string;
        stopLong: number,
        stopLat: number,
        zones: number[];
        transportType: number;
        routes: StopSearchRouteResult[];
        hasTicketMachine: boolean;
        inFreeTramZone: boolean;
        isReservationOnly: boolean;
        hasToilet: boolean;
        hasLift: boolean;
        stationStaffing: number,
        stationStaffingDescription: number,
        seatingType: string;
        sheltered: boolean;
        indoorWaitingArea: boolean;
        parkingSpots: number;
    }

    interface Disruption {
        id: number;
        title: string;
        url: string;
        description: string;
        status: string;
        type: string;
        startDate: string;
        endDate: string;
        updated: string;
    }

    interface Disruptions {
        generalDisruptions: Disruption[];
        transportDisruptions: Disruption[];
    }

    interface TransportType {
        name: string;
        id: number;
    }

    interface Departure {
        id: number;
        lineId: number;
        directionId: number;
        disruptions: number[];
        stopId: number;
        runRef: string;
        runId: number;
        platform: string;
        liveArrivalTimeUTC: string;
        timetabledArrivalTimeUTC: string;
    }

    interface Departures {
        departureLength: number;
        departures: Departure[];
        disruptions?: Disruption[];
        directions?: Direction[];
    }

    interface Direction {
        name: string;
        id: number;
        description: string;
        lineId: number;
        transportType: number;
    }

    interface RunStop {
        name: string;
        transportType: number;
        zones: number[];
        stopId: number;
        lineId: number[],
        id: number[],
        runRef: string;
        liveDepatureTime: string;
        timetabledDepatureTime: string;
        stopNumber: number;
        directionId: number;
    }

    interface RunDepartures {
        departures: RunStop[];
    }

    interface LineStop {
        id: string;
        name: string;
        stopNumber: number;
    }

    interface StopSearchResult {
        name: string;
        distance: number;
        id: number;
        suburb: string,
        transportType: number,
        stopLat: number,
        stopLong: number,
        routes: StopSearchRouteResult[]
    }

    interface StopSearchRouteResult {
        name: string;
        id: number;
        transportType: number;
    }

    function ptvClient(devId: number, apiKey: string): {
        calculateFareAsync: (zoneStart: number, zoneEnd: number) => Promise<TicketPrices>;
        getDetailedStopInfoAsync: (stopId: number, transportType: number, options?: DetailedStopOptions) => Promise<DetailedStop>;
        getAllTransportTypesAsync: () => Promise<TransportType[]>;
        getDeparturesForStopAsync: (stopId: number, transportTypeId: number, options: StopDepartureOptions) => Promise<Departures>;
        getDeparturesForARunAsync: (runRef: string | number, transportType: number) => Promise<RunDepartures>;
        getDirectionsForLineAsync: (lineId: number) => Promise<Direction[]>;
        getStopsOnALineAsync: (lineId: number, transportType: number, directionId: number) => Promise<LineStop[]>;
        searchForStopByLocationAsync: (latitude: number, longitude: number, transportFilters: number[], maxDistance?: number) => Promise<StopSearchResult[]>;
        searchForStopBySuburbAsync: (suburb: string, transportFilters: number[]) => Promise<StopSearchResult[]>;
        getFutureDisruptionsForStopAsync: (stopId: number, transportType: number) => Promise<Disruptions>;
        getCurrentDisruptionsForStopAsync: (stopId: number, transportType: number) => Promise<Disruptions>;
    }

    export = ptvClient;
}