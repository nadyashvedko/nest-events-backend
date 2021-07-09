import { Repository } from 'typeorm';
import { Event } from './event.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, Logger } from '@nestjs/common';
import { AttendeeAnswerEnum } from './attendee.entity';
import { ListEvents, WhenEventFilter } from './input/list.events';

@Injectable()
export class EventService {
  private readonly logger = new Logger(EventService.name);

  constructor(
    @InjectRepository(Event)
    private readonly eventsRepository: Repository<Event>,
  ) {}

  private getEventsBaseQuery() {
    return this.eventsRepository
      .createQueryBuilder('e')
      .orderBy('e.id', 'DESC');
  }

  public getEventsWithAttendeeCountQuery() {
    return this.getEventsBaseQuery()
      .loadRelationCountAndMap('e.attendeeCount', 'e.attendees')
      .loadRelationCountAndMap(
        'e.attendeeAccepted',
        'e.attendees',
        'attendee',
        (qb) =>
          qb.where('attendee.answer = :answer', {
            answer: AttendeeAnswerEnum.Accepted,
          }),
      )
      .loadRelationCountAndMap(
        'e.attendeeMaybe',
        'e.attendees',
        'attendee',
        (qb) =>
          qb.where('attendee.answer = :answer', {
            answer: AttendeeAnswerEnum.Maybe,
          }),
      )
      .loadRelationCountAndMap(
        'e.attendeeRejected',
        'e.attendees',
        'attendee',
        (qb) =>
          qb.where('attendee.answer = :answer', {
            answer: AttendeeAnswerEnum.Rejected,
          }),
      );
  }

  public async getEventsWithAttendeeCountFiltered(filter?: ListEvents) {
    let query = this.getEventsWithAttendeeCountQuery();
    if (!filter) {
      return query.getMany();
    }
    if (filter.time == WhenEventFilter.Today) {
      query = query.andWhere(
        `EXTRACT(DAY FROM e.time) = EXTRACT(DAY FROM CURRENT_DATE)`,
      );
    }
    if (filter.time == WhenEventFilter.Tomorrow) {
      query = query.andWhere(
        `EXTRACT(DAY FROM e.time) = (EXTRACT(DAY FROM CURRENT_DATE)-1)`,
      );
    }
    if (filter.time == WhenEventFilter.ThisWeek) {
      query = query.andWhere(
        'EXTRACT(WEEK FROM e.time) = EXTRACT(WEEK FROM CURRENT_DATE)',
      );
    }
    if (filter.time == WhenEventFilter.NextWeek) {
      query = query.andWhere(
        'EXTRACT(WEEK FROM e.time) = (EXTRACT(WEEK FROM CURRENT_DATE)+1)',
      );
    }
    return await query.getMany();
  }

  public async getEvent(id: number): Promise<Event | undefined> {
    const query = this.getEventsWithAttendeeCountQuery().andWhere(
      'e.id = :id',
      { id },
    );
    this.logger.debug(await query.getSql()); //generate sql generated by query
    return query.getOne();
  }
}