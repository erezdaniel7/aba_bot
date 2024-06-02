

import moment from 'moment';

import data from './sabbath.json';

export class Sabbath {

    public static getSabbathTime(date?: moment.MomentInput): any {
        return Array.from(data).find((row: any) => {
            return moment(date).isSame(moment(row.DATE, 'DD/MM/YYYY'), 'day');
        })
    }
}